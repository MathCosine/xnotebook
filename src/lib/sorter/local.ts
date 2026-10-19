import type { Note, Topic } from "../types";
import { prettifyTopicName, stems, tokenize } from "./text";

/**
 * Pulls a routing hashtag out of a jotted bit: "#mitosis prophase comes first"
 * → { topic: "Mitosis", content: "prophase comes first" }.
 * Only the first hashtag routes; the rest stay in the text.
 */
export function extractHashtag(text: string): { topic: string | null; content: string } {
  const m = text.match(/(^|\s)#([\p{L}\p{N}][\p{L}\p{N}_-]*)/u);
  if (!m || m.index === undefined) return { topic: null, content: text.trim() };
  const start = m.index + m[1].length;
  const content = (text.slice(0, start) + text.slice(start + m[2].length + 1)).replace(/\s{2,}/g, " ").trim();
  return { topic: prettifyTopicName(m[2]), content: content || text.trim() };
}

export interface Classification {
  topicId: string | null;
  score: number;
}

/**
 * On-device sorter: TF-IDF-ish overlap between the new bit and each topic's
 * "profile" (its name, weighted heavily, plus the bits already filed there).
 * It gets better as you file more. Returns null when nothing is a confident match.
 */
export function classify(content: string, topics: Topic[], notes: Note[]): Classification {
  const query = new Set(stems(content));
  if (query.size === 0 || topics.length === 0) return { topicId: null, score: 0 };

  const profiles = new Map<string, Map<string, number>>();
  for (const t of topics) {
    const p = new Map<string, number>();
    for (const s of stems(t.name)) p.set(s, (p.get(s) ?? 0) + 4);
    profiles.set(t.id, p);
  }
  for (const n of notes) {
    if (!n.topic_id) continue;
    const p = profiles.get(n.topic_id);
    if (!p) continue;
    for (const s of new Set(stems(n.content))) p.set(s, (p.get(s) ?? 0) + 1);
  }

  // How many topics mention a stem — common words across topics count for less.
  const df = new Map<string, number>();
  for (const p of profiles.values()) for (const s of p.keys()) df.set(s, (df.get(s) ?? 0) + 1);
  const n = topics.length;

  let best: Classification = { topicId: null, score: 0 };
  let second = 0;
  for (const [topicId, p] of profiles) {
    let score = 0;
    let norm = 0;
    for (const [s, w] of p) {
      const idf = Math.log(1 + n / (df.get(s) ?? 1));
      const weight = Math.log(1 + w) * idf;
      norm += weight * weight;
      if (query.has(s)) score += weight * idf;
    }
    if (score === 0) continue;
    // Dampen big topics so they don't swallow everything.
    const value = score / Math.sqrt(Math.max(norm, 1)) / Math.sqrt(query.size);
    if (value > best.score) {
      second = best.score;
      best = { topicId, score: value };
    } else if (value > second) {
      second = value;
    }
  }

  const confident = best.score >= 0.12 && best.score >= second * 1.15;
  return confident ? best : { topicId: null, score: best.score };
}

export interface TopicSuggestion {
  name: string;
  noteIds: string[];
}

/**
 * Looks for words that keep coming up across loose (unsorted) bits and
 * proposes them as new topics. Purely local — no AI needed.
 */
export function suggestTopics(loose: Note[], existing: Topic[], limit = 3): TopicSuggestion[] {
  const taken = new Set(existing.flatMap((t) => stems(t.name)));
  const byStem = new Map<string, { surfaces: Map<string, number>; noteIds: Set<string> }>();
  for (const note of loose) {
    for (const tok of tokenize(note.content)) {
      if (taken.has(tok.stem) || tok.surface.length < 4) continue;
      let entry = byStem.get(tok.stem);
      if (!entry) byStem.set(tok.stem, (entry = { surfaces: new Map(), noteIds: new Set() }));
      entry.surfaces.set(tok.surface, (entry.surfaces.get(tok.surface) ?? 0) + 1);
      entry.noteIds.add(note.id);
    }
  }
  const candidates = [...byStem.values()]
    .filter((e) => e.noteIds.size >= 2)
    .sort((a, b) => b.noteIds.size - a.noteIds.size);

  const out: TopicSuggestion[] = [];
  const used = new Set<string>();
  for (const c of candidates) {
    const ids = [...c.noteIds].filter((id) => !used.has(id));
    if (ids.length < 2) continue;
    const surface = [...c.surfaces.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
    out.push({ name: prettifyTopicName(surface), noteIds: ids });
    ids.forEach((id) => used.add(id));
    if (out.length >= limit) break;
  }
  return out;
}
