import { APP_NAME } from "./brand";
import type { Data, Note, Notebook } from "./types";

const MARK: Record<Note["kind"], string> = {
  fact: "- ",
  definition: "- ",
  exam: "- ⭐ ",
  todo: "- [ ] ",
  question: "- ❓ ",
  formula: "- ",
};

/** Markdown that pastes cleanly into Obsidian, Notion or GitHub ($math$ included). */
export function notebookToMarkdown(nb: Notebook, data: Data): string {
  const topics = data.topics.filter((t) => t.notebook_id === nb.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const notes = data.notes.filter((n) => n.notebook_id === nb.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const line = (n: Note) => MARK[n.kind] + n.content.replace(/\n/g, "\n  ") + (n.flag ? `\n  > ✎ ${n.flag}` : "");
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const out = [`# ${nb.name}`, "", `_Exported from ${APP_NAME} · ${date}_`, ""];
  for (const t of topics) {
    const inTopic = notes.filter((n) => n.topic_id === t.id);
    if (!inTopic.length) continue;
    out.push(`## ${t.name}`, "", ...inTopic.map(line), "");
  }
  const loose = notes.filter((n) => !n.topic_id);
  if (loose.length) out.push("## Loose leaf", "", ...loose.map(line), "");
  return out.join("\n");
}

export function download(filename: string, text: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "notebook";
