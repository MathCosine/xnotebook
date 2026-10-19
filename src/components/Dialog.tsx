import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

export function Dialog({ title, onClose, children, className = "" }: { title?: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    if (!ref.current?.contains(document.activeElement)) ref.current?.querySelector<HTMLElement>("input, button")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        {title && (
          <div className="sheet-head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
        )}
        <div className={title ? "sheet-body" : undefined}>{children}</div>
      </div>
    </div>
  );
}
