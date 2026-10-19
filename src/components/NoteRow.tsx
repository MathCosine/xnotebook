import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { renderNote, useKatexReady } from "../lib/render";
import {
  deleteNote,
  dismissFlag,
  findOrCreateTopic,
  getState,
  moveNote,
  restoreNote,
  review,
  updateNote,
} from "../lib/store";
import { clock, dayKey, dayLabel } from "../lib/time";
import { toast } from "../lib/toasts";
import { NOTE_KINDS, type Note, type Topic } from "../lib/types";
import { Icon, KIND_ICON, KIND_LABEL } from "./Icon";
import { Menu, MenuItem } from "./Menu";

export const tabStyle = (color: string | undefined) =>
  (color ? { "--tab-bg": `var(--tab-${color})` } : {}) as CSSProperties;

interface Props {
  note: Note;
  topics: Topic[];
  pending: boolean;
  smart: boolean;
  /** Show which topic it's in (used on the "On the test" tab). */
  showTopic?: boolean;
  flash?: boolean;
}

export const NoteRow = memo(function NoteRow({ note, topics, pending, smart, showTopic, flash }: Props) {
  useKatexReady();
  const [editing, setEditing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; view: "main" | "move" | "kind" } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const topic = topics.find((t) => t.id === note.topic_id);

  useEffect(() => {
    if (flash) rowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [flash]);

  const remove = () => {
    const removed = deleteNote(note.id);
    if (removed) toast({ message: "Bit deleted.", action: { label: "Undo", run: () => restoreNote(removed) } });
  };

  const closeMenu = () => setMenu(null);

  return (
    <div
      ref={rowRef}
      className={`note${flash ? " flash" : ""}`}
      data-kind={note.kind}
      data-pinned={note.pinned}
      data-note-id={note.id}
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/x-note-id", note.id);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("dragging");
      }}
      onDragEnd={(e) => e.currentTarget.classList.remove("dragging")}
    >
      <button
        type="button"
        className="note-glyph"
        title={`${KIND_LABEL[note.kind]} — change`}
        aria-label={`Kind: ${KIND_LABEL[note.kind]}. Change`}
        onClick={(e) => setMenu({ anchor: e.currentTarget, view: "kind" })}
      >
        <Icon name={KIND_ICON[note.kind]} size={note.kind === "fact" ? 14 : 18} />
      </button>

      <div style={{ minWidth: 0 }}>
        {editing ? (
          <NoteEditor note={note} onDone={() => setEditing(false)} />
        ) : (
          <div className="note-text" onClick={(e) => !(e.target as HTMLElement).closest("a") && setEditing(true)}>
            <span dangerouslySetInnerHTML={{ __html: renderNote(note.content) }} />
            {showTopic && topic && (
              <span className="note-badge" style={{ ...tabStyle(topic.color), background: "var(--tab-bg)", color: "var(--ink)" }}>
                {topic.name}
              </span>
            )}
          </div>
        )}
        {showOriginal && note.original && <span className="note-original">{note.original}</span>}
        {note.flag && (
          <div className="flag-note">
            <Icon name="pencil" size={15} />
            <span>{note.flag}</span>
            <button type="button" className="flag-x" onClick={() => dismissFlag(note.id)} aria-label="Dismiss margin note" title="Got it">
              <Icon name="close" size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="note-meta">
        {pending ? (
          <span className="note-badge filing" title="Claude is filing this">
            <Icon name="pencil" size={13} /> <span className="badge-label">filing</span>
          </span>
        ) : (
          note.original && (
            <button
              type="button"
              className="note-badge"
              title={showOriginal ? "Hide what you typed" : "Tidied up — show what you typed"}
              onClick={() => setShowOriginal((v) => !v)}
            >
              <Icon name="eye" size={13} /> <span className="badge-label">{showOriginal ? "hide" : "tidied"}</span>
            </button>
          )
        )}
        <span className="note-time" title={new Date(note.created_at).toLocaleString()}>
          {dayKey(note.created_at) === dayKey(new Date().toISOString()) ? clock(note.created_at) : dayLabel(note.created_at)}
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Bit options"
          aria-haspopup="menu"
          aria-expanded={menu !== null}
          onClick={(e) => setMenu(menu ? null : { anchor: e.currentTarget, view: "main" })}
        >
          <Icon name="more" size={18} />
        </button>
      </div>

      {menu && (
        <Menu anchor={menu.anchor} onClose={closeMenu}>
          {menu.view === "main" && (
            <>
              <MenuItem icon="tab" onClick={() => setMenu({ ...menu, view: "move" })}>
                Move to…
              </MenuItem>
              <MenuItem icon={KIND_ICON[note.kind]} onClick={() => setMenu({ ...menu, view: "kind" })}>
                Mark as…
              </MenuItem>
              <MenuItem
                icon="pin"
                onClick={() => {
                  updateNote(note.id, { pinned: !note.pinned });
                  closeMenu();
                }}
              >
                {note.pinned ? "Unpin" : "Pin to top of topic"}
              </MenuItem>
              <MenuItem
                icon="pencil"
                onClick={() => {
                  setEditing(true);
                  closeMenu();
                }}
              >
                Edit
              </MenuItem>
              {note.original && (
                <MenuItem
                  icon="undo"
                  onClick={() => {
                    updateNote(note.id, { content: note.original!, original: null });
                    closeMenu();
                  }}
                >
                  Go back to what I typed
                </MenuItem>
              )}
              {smart && (
                <MenuItem
                  icon="check"
                  onClick={() => {
                    closeMenu();
                    void review([note.id]).then((r) => {
                      if (r) toast({ message: r.changed || r.flagged ? "Sonnet made a correction." : "Sonnet checked it — looks right." });
                    });
                  }}
                >
                  Ask Sonnet to check
                </MenuItem>
              )}
              <MenuItem
                icon="copy"
                onClick={() => {
                  void navigator.clipboard?.writeText(note.content);
                  closeMenu();
                  toast({ message: "Copied." }, 1800);
                }}
              >
                Copy text
              </MenuItem>
              <div className="menu-sep" />
              <MenuItem
                icon="trash"
                danger
                onClick={() => {
                  closeMenu();
                  remove();
                }}
              >
                Delete
              </MenuItem>
            </>
          )}
          {menu.view === "move" && (
            <>
              <div className="menu-label">Move to</div>
              {topics.map((t) => (
                <MenuItem
                  key={t.id}
                  checked={t.id === note.topic_id}
                  onClick={() => {
                    moveNote(note.id, t.id);
                    closeMenu();
                  }}
                >
                  <span className="swatch-dot" style={{ ...tabStyle(t.color), display: "inline-block", marginRight: 8, verticalAlign: "-2px" }} />
                  {t.name}
                </MenuItem>
              ))}
              <MenuItem
                icon="leaf"
                checked={note.topic_id === null}
                onClick={() => {
                  moveNote(note.id, null);
                  closeMenu();
                }}
              >
                Loose leaf
              </MenuItem>
              <div className="menu-sep" />
              <MenuItem
                icon="plus"
                onClick={() => {
                  const name = prompt("New topic name")?.trim();
                  if (name) moveNote(note.id, findOrCreateTopic(note.notebook_id, name).id);
                  closeMenu();
                }}
              >
                New topic…
              </MenuItem>
            </>
          )}
          {menu.view === "kind" && (
            <>
              <div className="menu-label">This bit is a…</div>
              {NOTE_KINDS.map((k) => (
                <MenuItem
                  key={k}
                  icon={KIND_ICON[k]}
                  checked={note.kind === k}
                  onClick={() => {
                    updateNote(note.id, { kind: k });
                    closeMenu();
                  }}
                >
                  {KIND_LABEL[k]}
                </MenuItem>
              ))}
            </>
          )}
        </Menu>
      )}
    </div>
  );
});

function NoteEditor({ note, onDone }: { note: Note; onDone: () => void }) {
  const [value, setValue] = useState(note.content);
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const save = () => {
    const v = value.trim();
    // Still there? (it may have been deleted from another device)
    if (v && v !== note.content && getState().data.notes.some((n) => n.id === note.id)) updateNote(note.id, { content: v });
    onDone();
  };

  return (
    <textarea
      ref={ref}
      className="note-edit"
      value={value}
      rows={1}
      aria-label="Edit bit"
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          save();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onDone();
        }
      }}
    />
  );
}
