import { useMemo, useState } from "react";
import { APP_NAME } from "../lib/brand";
import { go, notebookHref } from "../lib/route";
import { createNotebook, setPrefs, useApp } from "../lib/store";
import { Logo, NotebookCover } from "./Art";
import { Icon } from "./Icon";

export function Wordmark() {
  // "xleaf" → a red pencil x and a serif "leaf".
  const [first, rest] = [APP_NAME[0], APP_NAME.slice(1)];
  return (
    <span className="wordmark">
      <em>{first}</em>
      {rest}
    </span>
  );
}

export function Shelf({ activeId, onSearch, onSettings }: { activeId: string | null; onSearch: () => void; onSettings: () => void }) {
  const { data, scope, sync, prefs } = useApp();
  const [name, setName] = useState("");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of data.notes) m.set(n.notebook_id, (m.get(n.notebook_id) ?? 0) + 1);
    return m;
  }, [data.notes]);

  const notebooks = useMemo(() => [...data.notebooks].sort((a, b) => a.created_at.localeCompare(b.created_at)), [data.notebooks]);

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const nextTheme = prefs.theme === "chalk" ? "paper" : "chalk";
  const dark = prefs.theme === "chalk" || (prefs.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <aside className="shelf" aria-label="Notebooks">
      <div className="shelf-head">
        <Logo size={32} />
        <Wordmark />
      </div>

      <button type="button" className="shelf-search" onClick={onSearch}>
        <Icon name="search" size={17} />
        Search bits
        <kbd>{isMac ? "⌘K" : "Ctrl K"}</kbd>
      </button>

      <div className="shelf-label">
        <span>Notebooks</span>
        <span>{notebooks.length || ""}</span>
      </div>

      <nav className="shelf-list">
        {notebooks.map((nb) => (
          <a key={nb.id} className="spine" href={notebookHref(nb.id)} aria-current={nb.id === activeId ? "page" : undefined}>
            <NotebookCover color={nb.color} seed={nb.id} width={24} label={false} />
            <span className="spine-name">{nb.name}</span>
            <span className="spine-count">{counts.get(nb.id) ?? 0}</span>
          </a>
        ))}
        <form
          className="new-notebook"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const nb = createNotebook(name);
            setName("");
            go(notebookHref(nb.id));
          }}
        >
          <input className="input" placeholder="New notebook…" value={name} onChange={(e) => setName(e.target.value)} aria-label="New notebook name" />
          <button type="submit" className="btn btn-sm" aria-label="Create notebook" disabled={!name.trim()}>
            <Icon name="plus" size={16} />
          </button>
        </form>
      </nav>

      <div className="shelf-foot">
        <span className="sync-pill" data-state={sync} title={scope.kind === "cloud" ? `Synced to ${scope.email ?? "your account"}` : "Saved in this browser"}>
          <Icon name={scope.kind === "local" ? "device" : sync === "offline" ? "cloudOff" : "cloud"} size={16} />
          <span>
            {scope.kind === "local" ? "This device" : sync === "offline" ? "Offline — will sync" : sync === "saving" ? "Saving…" : "Synced"}
          </span>
        </span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setPrefs({ theme: nextTheme })}
          aria-label={dark ? "Switch to paper" : "Switch to chalkboard"}
          title={dark ? "Paper" : "Chalkboard"}
        >
          <Icon name={dark ? "sun" : "moon"} size={18} />
        </button>
        <button type="button" className="icon-btn" onClick={onSettings} aria-label="Settings" title="Settings">
          <Icon name="sliders" size={18} />
        </button>
      </div>
    </aside>
  );
}
