import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { plainText } from "../lib/render";
import { jot, moveNote, useApp } from "../lib/store";
import type { Topic } from "../lib/types";
import { Icon } from "./Icon";
import { Menu, MenuItem } from "./Menu";
import { tabStyle } from "./NoteRow";

const PLACEHOLDERS = [
  "Jot something down…",
  "mitosis → 2 identical daughter cells",
  "#enzymes lower the activation energy",
  "test friday ch 4-5 !!",
  "F = ma, a in m/s^2",
  "why is the sky blue? ask after class",
];

export function CaptureBar({ notebookId, topics, onOpenSettings }: { notebookId: string; topics: Topic[]; onOpenSettings: () => void }) {
  const { data, aiPending, prefs, puter } = useApp();
  const [value, setValue] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [placeholder, setPlaceholder] = useState(0);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; noteId: string } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  // New notebook → fresh "just jotted" strip.
  useEffect(() => setRecent([]), [notebookId]);

  useEffect(() => {
    const t = setInterval(() => setPlaceholder((p) => (p + 1) % PLACEHOLDERS.length), 4200);
    return () => clearInterval(t);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  // "/" or "n" anywhere jumps to the capture box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "/" || e.key === "n") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = () => {
    const result = jot(notebookId, value);
    if (!result) return;
    setValue("");
    setRecent((r) => [result.note.id, ...r].slice(0, 4));
  };

  const recentNotes = useMemo(
    () => recent.map((id) => data.notes.find((n) => n.id === id)).filter((n) => n !== undefined),
    [recent, data.notes],
  );

  const smartOn = prefs.smartFiling && puter.state === "signed-in";

  return (
    <div className="capture-wrap">
      <div className="capture">
        {recentNotes.length > 0 && (
          <div className="recent" aria-label="Just jotted">
            {recentNotes.map((n) => {
              const topic = topics.find((t) => t.id === n.topic_id);
              const filing = aiPending.has(n.id);
              return (
                <div key={n.id} className="recent-item">
                  <span className="snippet">{plainText(n.content)}</span>
                  <button
                    type="button"
                    className="to"
                    style={tabStyle(topic?.color)}
                    title="Move it"
                    onClick={(e) => setMenu({ anchor: e.currentTarget, noteId: n.id })}
                  >
                    {filing ? (
                      <span className="filing">
                        <Icon name="pencil" size={12} /> filing…
                      </span>
                    ) : (
                      <>
                        <Icon name={topic ? "arrow" : "leaf"} size={12} />
                        {topic?.name ?? "Loose leaf"}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <form
          className="capture-box"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Icon name="pencil" size={20} />
          <label className="sr-only" htmlFor="capture">
            Jot a bit
          </label>
          <textarea
            id="capture"
            ref={ref}
            className="capture-input"
            rows={1}
            value={value}
            placeholder={PLACEHOLDERS[placeholder]}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            enterKeyHint="send"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={!value.trim()} aria-label="File it">
            <Icon name="enter" size={16} />
            <span>File it</span>
          </button>
        </form>

        <div className="capture-hint">
          <span>
            <kbd>⏎</kbd> file it · <kbd>⇧⏎</kbd> new line
          </span>
          <span>
            <b>#topic</b> picks the tab
          </span>
          <span>
            <b>!!</b> or “on the test” highlights it
          </span>
          <button type="button" className="link" style={{ marginLeft: "auto", fontSize: 12.5 }} onClick={onOpenSettings}>
            {smartOn ? "Smart filing on" : "On-device sorting"}
          </button>
        </div>
      </div>

      {menu && (
        <Menu anchor={menu.anchor} onClose={() => setMenu(null)}>
          <div className="menu-label">Move to</div>
          {topics.map((t) => (
            <MenuItem
              key={t.id}
              checked={data.notes.find((n) => n.id === menu.noteId)?.topic_id === t.id}
              onClick={() => {
                moveNote(menu.noteId, t.id);
                setMenu(null);
              }}
            >
              {t.name}
            </MenuItem>
          ))}
          <MenuItem
            icon="leaf"
            onClick={() => {
              moveNote(menu.noteId, null);
              setMenu(null);
            }}
          >
            Loose leaf
          </MenuItem>
        </Menu>
      )}
    </div>
  );
}
