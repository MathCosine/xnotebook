import { useMemo, useState } from "react";
import { plainText } from "../lib/render";
import { go, notebookHref } from "../lib/route";
import { useApp } from "../lib/store";
import { dayLabel } from "../lib/time";
import type { Note } from "../lib/types";
import { NothingFoundArt } from "./Art";
import { Dialog } from "./Dialog";
import { Icon, KIND_ICON } from "./Icon";
import { tabStyle } from "./NoteRow";

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function SearchPalette({ onClose, onPick }: { onClose: () => void; onPick: (note: Note) => void }) {
  const { data } = useApp();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const results = useMemo(() => {
    const sorted = [...data.notes].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (!words.length) return sorted.slice(0, 8);
    const topicName = new Map(data.topics.map((t) => [t.id, t.name.toLowerCase()]));
    return sorted
      .filter((n) => {
        const hay = `${plainText(n.content)} ${n.original ?? ""} ${topicName.get(n.topic_id ?? "") ?? ""}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q]);

  const highlight = (text: string) => {
    const safe = escape(plainText(text));
    if (!words.length) return safe;
    return safe.replace(new RegExp(`(${words.map((w) => escapeRe(escape(w))).join("|")})`, "gi"), "<mark>$1</mark>");
  };

  const pick = (n: Note | undefined) => {
    if (!n) return;
    onPick(n);
    go(notebookHref(n.notebook_id, n.topic_id ?? "loose"));
    onClose();
  };

  return (
    <Dialog onClose={onClose} className="palette">
      <div className="palette-input">
        <Icon name="search" size={20} />
        <input
          autoFocus
          placeholder="Search every notebook…"
          value={q}
          aria-label="Search"
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter") {
              pick(results[sel]);
            }
          }}
        />
        <kbd>esc</kbd>
      </div>
      <div className="results" role="listbox" aria-label="Results">
        {!words.length && results.length > 0 && <div className="menu-label">Recent bits</div>}
        {results.map((n, i) => {
          const nb = data.notebooks.find((x) => x.id === n.notebook_id);
          const topic = data.topics.find((t) => t.id === n.topic_id);
          return (
            <button
              key={n.id}
              type="button"
              role="option"
              aria-selected={i === sel}
              className="result"
              onMouseEnter={() => setSel(i)}
              onClick={() => pick(n)}
            >
              <span className="result-text" dangerouslySetInnerHTML={{ __html: highlight(n.content) }} />
              <span className="result-where">
                <Icon name={KIND_ICON[n.kind]} size={13} />
                {nb?.name}
                <span>›</span>
                <span className="dot" style={tabStyle(topic?.color)} />
                {topic?.name ?? "Loose leaf"}
                <span style={{ marginLeft: "auto" }}>{dayLabel(n.created_at)}</span>
              </span>
            </button>
          );
        })}
        {words.length > 0 && results.length === 0 && (
          <div className="empty">
            <NothingFoundArt />
            <p className="hint">Nothing matches “{q}”.</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
