import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import { download, notebookToMarkdown, slug } from "../lib/exporter";
import { go, notebookHref } from "../lib/route";
import { suggestTopics } from "../lib/sorter/local";
import {
  acceptMerge,
  acceptSuggestion,
  deleteNotebook,
  deleteTopic,
  dismissMerge,
  findOrCreateTopic,
  mergeTopic,
  moveNote,
  refileLoose,
  review,
  updateNotebook,
  updateTopic,
  useApp,
  useMergeSuggestions,
} from "../lib/store";
import { ago, dayKey, dayLabel } from "../lib/time";
import { toast } from "../lib/toasts";
import { COVER_COLORS, TAB_COLORS, type Note, type Notebook, type Topic } from "../lib/types";
import { AllFiledArt, COVER_HEX, NotebookCover, OpenNotebookArt } from "./Art";
import { CaptureBar } from "./CaptureBar";
import { Icon } from "./Icon";
import { MenuButton, MenuItem } from "./Menu";
import { NoteRow, tabStyle } from "./NoteRow";

const byTime = (a: Note, b: Note) => Number(b.pinned) - Number(a.pinned) || a.created_at.localeCompare(b.created_at);

export function NotebookView({
  notebook,
  tab,
  flashId,
  onOpenSettings,
  onOpenDrawer,
}: {
  notebook: Notebook;
  tab: string;
  flashId: string | null;
  onOpenSettings: () => void;
  onOpenDrawer: () => void;
}) {
  const { data, aiPending, prefs, puter } = useApp();
  const merges = useMergeSuggestions().filter((m) => m.notebookId === notebook.id);
  const smart = prefs.smartFiling && puter.state === "signed-in";

  const topics = useMemo(
    () => data.topics.filter((t) => t.notebook_id === notebook.id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [data.topics, notebook.id],
  );
  const notes = useMemo(() => data.notes.filter((n) => n.notebook_id === notebook.id), [data.notes, notebook.id]);
  const loose = useMemo(() => notes.filter((n) => !n.topic_id).sort(byTime), [notes]);
  const exam = useMemo(() => notes.filter((n) => n.kind === "exam").sort(byTime), [notes]);
  const byTopic = useMemo(() => {
    const m = new Map<string, Note[]>();
    for (const n of notes) if (n.topic_id) m.set(n.topic_id, [...(m.get(n.topic_id) ?? []), n]);
    for (const list of m.values()) list.sort(byTime);
    return m;
  }, [notes]);

  const activeTopic = topics.find((t) => t.id === tab);
  const currentTab = activeTopic ? tab : tab === "loose" || tab === "exam" ? tab : "all";
  const latest = notes.reduce((m, n) => (n.created_at > m ? n.created_at : m), "");

  const rowProps = (n: Note) => ({
    note: n,
    topics,
    pending: aiPending.has(n.id),
    smart,
    flash: n.id === flashId,
  });

  const runReview = async (ids: string[]) => {
    if (!ids.length) {
      toast({ message: "Nothing new to review." });
      return;
    }
    toast({ message: `Sonnet is reading over ${ids.length} bit${ids.length === 1 ? "" : "s"}…` }, 2500);
    const r = await review(ids);
    if (!r) return;
    const parts = [r.changed && `fixed ${r.changed}`, r.flagged && `left ${r.flagged} margin note${r.flagged === 1 ? "" : "s"}`].filter(Boolean);
    toast({ message: `Checked ${r.checked} bit${r.checked === 1 ? "" : "s"}${parts.length ? ` — ${parts.join(", ")}` : " — all good"}.` });
  };

  const unreviewed = notes.filter((n) => n.review !== "done").sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60);

  return (
    <>
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onOpenDrawer} aria-label="Open notebooks">
          <Icon name="menu" />
        </button>
        <NotebookCover color={notebook.color} seed={notebook.id} width={20} label={false} />
      </div>

      <header className="nb-head">
        <NotebookCover color={notebook.color} seed={notebook.id} width={46} />
        <div className="nb-title-wrap">
          <EditableTitle value={notebook.name} onSave={(name) => updateNotebook(notebook.id, { name })} />
          <div className="nb-meta">
            {notes.length} bit{notes.length === 1 ? "" : "s"} · {topics.length} topic{topics.length === 1 ? "" : "s"}
            {latest && ` · last jotted ${ago(latest)}`}
          </div>
        </div>
        <div className="nb-actions">
          {smart && (
            <button type="button" className="btn-quiet" onClick={() => void runReview(unreviewed.map((n) => n.id))} title="Sonnet checks filing, rewrites and facts">
              <Icon name="check" size={18} />
              <span className="hide-sm">Review</span>
            </button>
          )}
          <MenuButton label="Notebook options">
            {(close) => (
              <>
                <MenuItem
                  icon="download"
                  onClick={() => {
                    download(`${slug(notebook.name)}.md`, notebookToMarkdown(notebook, data));
                    close();
                  }}
                >
                  Export as Markdown
                </MenuItem>
                <div className="menu-label">Cover</div>
                <div className="menu-swatches">
                  {COVER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      aria-pressed={notebook.color === c}
                      style={{ background: COVER_HEX[c] }}
                      onClick={() => updateNotebook(notebook.id, { color: c })}
                    />
                  ))}
                </div>
                <div className="menu-sep" />
                <MenuItem
                  icon="trash"
                  danger
                  onClick={() => {
                    close();
                    if (confirm(`Delete “${notebook.name}” and all ${notes.length} bits in it? This can't be undone.`)) {
                      deleteNotebook(notebook.id);
                      go("#/", true);
                    }
                  }}
                >
                  Delete notebook
                </MenuItem>
              </>
            )}
          </MenuButton>
        </div>
      </header>

      <Tabs notebookId={notebook.id} current={currentTab} topics={topics} byTopic={byTopic} looseCount={loose.length} examCount={exam.length} />

      <div className="page-scroll">
        <div className="page" style={tabStyle(activeTopic?.color)}>
          {merges.map((m) => {
            const from = topics.find((t) => t.id === m.fromId);
            const into = topics.find((t) => t.id === m.intoId);
            if (!from || !into) return null;
            return (
              <div key={m.fromId + m.intoId} className="loose-callout">
                <Icon name="merge" size={17} />
                <span>
                  Sonnet thinks <b>{from.name}</b> and <b>{into.name}</b> are the same topic.
                </span>
                <button type="button" className="chip" onClick={() => acceptMerge(m)}>
                  Merge into {into.name}
                </button>
                <button type="button" className="btn-quiet" onClick={() => dismissMerge(m)}>
                  Keep both
                </button>
              </div>
            );
          })}

          {notes.length === 0 ? (
            <EmptyNotebook />
          ) : currentTab === "exam" ? (
            exam.length ? (
              <Section title="On the test" icon="star" count={exam.length}>
                {exam.map((n) => (
                  <NoteRow key={n.id} {...rowProps(n)} showTopic />
                ))}
              </Section>
            ) : (
              <div className="empty">
                <p className="hint">Nothing flagged for the test yet. Add “!!” or “on the test” to a bit, or mark it from its menu.</p>
              </div>
            )
          ) : currentTab === "loose" ? (
            <LooseSection notebookId={notebook.id} notes={loose} topics={topics} rowProps={rowProps} />
          ) : activeTopic ? (
            <TopicSection topic={activeTopic} topics={topics} notes={byTopic.get(activeTopic.id) ?? []} rowProps={rowProps} smart={smart} onReview={runReview} />
          ) : (
            <>
              {loose.length > 0 && <LooseSection notebookId={notebook.id} notes={loose} topics={topics} rowProps={rowProps} />}
              {topics.map((t) => (
                <TopicSection key={t.id} topic={t} topics={topics} notes={byTopic.get(t.id) ?? []} rowProps={rowProps} smart={smart} onReview={runReview} compact />
              ))}
            </>
          )}
        </div>
      </div>

      <CaptureBar notebookId={notebook.id} topics={topics} onOpenSettings={onOpenSettings} />
    </>
  );
}

/* ───────────── pieces ───────────── */

type RowProps = (n: Note) => { note: Note; topics: Topic[]; pending: boolean; smart: boolean; flash: boolean };

/** Notes in order, with a dated divider whenever a section spans more than one class. */
function withDayMarks(notes: Note[], rowProps: RowProps) {
  const days = new Set(notes.filter((n) => !n.pinned).map((n) => dayKey(n.created_at)));
  let lastDay = "";
  return notes.flatMap((n) => {
    const row = <NoteRow key={n.id} {...rowProps(n)} />;
    if (n.pinned || days.size < 2) return [row];
    const day = dayKey(n.created_at);
    if (day === lastDay) return [row];
    lastDay = day;
    return [
      <div key={`d${n.id}`} className="day-sep">
        {dayLabel(n.created_at)}
      </div>,
      row,
    ];
  });
}

function Section({
  title,
  icon,
  count,
  color,
  tools,
  onTitle,
  children,
}: {
  title: string;
  icon?: "star" | "leaf";
  count: number;
  color?: string;
  tools?: ReactNode;
  onTitle?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="section" style={tabStyle(color)}>
      <div className="section-head">
        {color && <span className="flag" aria-hidden="true" />}
        {icon && <Icon name={icon} size={18} />}
        <h2>{onTitle ? <button type="button" onClick={onTitle}>{title}</button> : title}</h2>
        <span className="count">{count}</span>
        {tools && <div className="section-tools">{tools}</div>}
      </div>
      {children}
    </section>
  );
}

function TopicSection({
  topic,
  topics,
  notes,
  rowProps,
  smart,
  onReview,
  compact,
}: {
  topic: Topic;
  topics: Topic[];
  notes: Note[];
  rowProps: RowProps;
  smart: boolean;
  onReview: (ids: string[]) => Promise<void>;
  compact?: boolean;
}) {
  return (
    <Section
      title={topic.name}
      count={notes.length}
      color={topic.color}
      onTitle={compact ? () => go(notebookHref(topic.notebook_id, topic.id)) : undefined}
      tools={
        <MenuButton label={`${topic.name} options`}>
          {(close) => (
            <>
              <MenuItem
                icon="pencil"
                onClick={() => {
                  close();
                  const name = prompt("Rename topic", topic.name)?.trim();
                  if (name) updateTopic(topic.id, { name });
                }}
              >
                Rename
              </MenuItem>
              <div className="menu-label">Tab colour</div>
              <div className="menu-swatches">
                {TAB_COLORS.map((c) => (
                  <button key={c} type="button" aria-label={c} aria-pressed={topic.color === c} style={tabStyle(c)} onClick={() => updateTopic(topic.id, { color: c })} />
                ))}
              </div>
              {smart && notes.length > 0 && (
                <MenuItem
                  icon="check"
                  onClick={() => {
                    close();
                    void onReview(notes.map((n) => n.id));
                  }}
                >
                  Review this topic with Sonnet
                </MenuItem>
              )}
              {topics.length > 1 && (
                <>
                  <div className="menu-label">Merge into</div>
                  {topics
                    .filter((t) => t.id !== topic.id)
                    .map((t) => (
                      <MenuItem
                        key={t.id}
                        icon="merge"
                        onClick={() => {
                          close();
                          mergeTopic(topic.id, t.id);
                          go(notebookHref(t.notebook_id, t.id), true);
                        }}
                      >
                        {t.name}
                      </MenuItem>
                    ))}
                </>
              )}
              <div className="menu-sep" />
              <MenuItem
                icon="trash"
                danger
                onClick={() => {
                  close();
                  if (confirm(`Delete the “${topic.name}” tab? Its ${notes.length} bits move to Loose leaf.`)) {
                    deleteTopic(topic.id);
                    go(notebookHref(topic.notebook_id), true);
                  }
                }}
              >
                Delete tab
              </MenuItem>
            </>
          )}
        </MenuButton>
      }
    >
      {notes.length ? withDayMarks(notes, rowProps) : <p className="hint empty-line">Nothing here yet — bits about {topic.name} will land here.</p>}
    </Section>
  );
}

function LooseSection({ notebookId, notes, topics, rowProps }: { notebookId: string; notes: Note[]; topics: Topic[]; rowProps: RowProps }) {
  const suggestions = useMemo(() => suggestTopics(notes, topics), [notes, topics]);
  if (!notes.length)
    return (
      <div className="empty">
        <AllFiledArt />
        <h2>All filed</h2>
        <p className="hint">Bits that don't fit a topic yet wait here.</p>
      </div>
    );
  return (
    <Section
      title="Loose leaf"
      icon="leaf"
      count={notes.length}
      tools={
        <button
          type="button"
          className="btn-quiet"
          onClick={() => {
            const r = refileLoose(notebookId);
            if (r === "smart") toast({ message: "Filing loose bits…" }, 2000);
            else toast({ message: r ? `Filed ${r} bit${r === 1 ? "" : "s"}.` : "Still not sure where these go — try a #topic or a suggestion below." });
          }}
        >
          <Icon name="refile" size={16} /> Re-file
        </button>
      }
    >
      {suggestions.length > 0 && (
        <div className="loose-callout">
          <span>Looks like a topic:</span>
          {suggestions.map((s) => (
            <button key={s.name} type="button" className="chip" onClick={() => acceptSuggestion(notebookId, s)}>
              <Icon name="plus" size={13} /> {s.name} <span style={{ opacity: 0.6 }}>· {s.noteIds.length}</span>
            </button>
          ))}
        </div>
      )}
      {withDayMarks(notes, rowProps)}
    </Section>
  );
}

function EmptyNotebook() {
  return (
    <div className="empty">
      <OpenNotebookArt />
      <h2>A fresh notebook</h2>
      <p>Type whatever your teacher just said into the box below. Each bit gets filed under a topic on its own.</p>
      <div className="examples">
        <code>photosynthesis happens in the chloroplast</code>
        <code>#vocab ephemeral = lasting a short time</code>
        <code>quiz on thursday — know the krebs cycle !!</code>
      </div>
    </div>
  );
}

function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing)
    return (
      <h1
        className="nb-title"
        title="Rename"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value}
      </h1>
    );
  const done = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== value) onSave(draft.trim());
  };
  return (
    <input
      className="nb-title-input"
      value={draft}
      autoFocus
      aria-label="Notebook name"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={done}
      onKeyDown={(e) => {
        if (e.key === "Enter") done();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

function Tabs({
  notebookId,
  current,
  topics,
  byTopic,
  looseCount,
  examCount,
}: {
  notebookId: string;
  current: string;
  topics: Topic[];
  byTopic: Map<string, Note[]>;
  looseCount: number;
  examCount: number;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [over, setOver] = useState<string | null>(null);

  const drop = (target: string | null) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes("text/x-note-id")) return;
      e.preventDefault();
      setOver(target ?? "loose");
    },
    onDragLeave: () => setOver(null),
    onDrop: (e: DragEvent) => {
      const id = e.dataTransfer.getData("text/x-note-id");
      setOver(null);
      if (id) moveNote(id, target);
    },
  });

  const tabProps = (key: string) => ({
    role: "tab" as const,
    "aria-selected": current === key,
    onClick: () => go(notebookHref(notebookId, key)),
  });

  return (
    <div className="tabs" role="tablist" aria-label="Topics">
      <button type="button" className="tab tab-all" {...tabProps("all")}>
        All
      </button>
      {(looseCount > 0 || current === "loose") && (
        <button type="button" className={`tab tab-loose${over === "loose" ? " drop-target" : ""}`} {...tabProps("loose")} {...drop(null)}>
          <Icon name="leaf" size={15} /> Loose leaf <span className="count">{looseCount}</span>
        </button>
      )}
      {(examCount > 0 || current === "exam") && (
        <button type="button" className="tab tab-exam" {...tabProps("exam")}>
          <Icon name="star" size={15} /> On the test <span className="count">{examCount}</span>
        </button>
      )}
      {topics.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tab${over === t.id ? " drop-target" : ""}`}
          style={tabStyle(t.color)}
          {...tabProps(t.id)}
          {...drop(t.id)}
        >
          {t.name} <span className="count">{byTopic.get(t.id)?.length ?? 0}</span>
        </button>
      ))}
      {adding ? (
        <form
          className="tab tab-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) {
              const t = findOrCreateTopic(notebookId, name.trim());
              go(notebookHref(notebookId, t.id));
            }
            setAdding(false);
            setName("");
          }}
        >
          <input
            className="tab-add-input"
            autoFocus
            placeholder="New topic"
            value={name}
            aria-label="New topic name"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => !name.trim() && setAdding(false)}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
          />
        </form>
      ) : (
        <button type="button" className="tab tab-add" onClick={() => setAdding(true)} aria-label="Add a topic" title="Add a topic">
          <Icon name="plus" size={16} />
        </button>
      )}
    </div>
  );
}
