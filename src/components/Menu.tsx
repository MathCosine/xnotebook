import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./Icon";

/** A popover menu anchored to an element; closes on outside click, Escape or scroll. */
export function Menu({ anchor, onClose, children }: { anchor: HTMLElement; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const a = anchor.getBoundingClientRect();
    const m = el.getBoundingClientRect();
    const below = window.innerHeight - a.bottom;
    const top = below > m.height + 12 || a.top < m.height + 12 ? a.bottom + 6 : a.top - m.height - 6;
    const left = Math.min(Math.max(8, a.right - m.width), window.innerWidth - m.width - 8);
    setPos({ top: Math.max(8, top), left });
  }, [anchor, children]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        anchor.focus();
      }
    };
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    ref.current?.querySelector<HTMLElement>("button, input")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return createPortal(
    <div
      ref={ref}
      className="menu"
      role="menu"
      onKeyDown={onKeyDown}
      style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function MenuButton({
  label,
  icon = "more",
  className = "icon-btn",
  children,
  text,
}: {
  label: string;
  icon?: IconName;
  className?: string;
  text?: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        <Icon name={icon} size={18} />
        {text}
      </button>
      {anchor && (
        <Menu anchor={anchor} onClose={close}>
          {children(close)}
        </Menu>
      )}
    </>
  );
}

export function MenuItem({
  icon,
  children,
  onClick,
  danger,
  checked,
  style,
}: {
  icon?: IconName;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  checked?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      role={checked === undefined ? "menuitem" : "menuitemradio"}
      aria-checked={checked}
      className={`menu-item${danger ? " danger" : ""}`}
      onClick={onClick}
      style={style}
    >
      {icon && <Icon name={icon} size={17} />}
      <span>{children}</span>
    </button>
  );
}
