export type NoteKind = "fact" | "definition" | "exam" | "todo" | "question" | "formula";

export const NOTE_KINDS: NoteKind[] = ["fact", "definition", "exam", "todo", "question", "formula"];

/** Who decided which topic a note lives under. "you" is never overridden by sorting. */
export type SortedBy = "you" | "auto" | "ai";

export interface Notebook {
  id: string;
  name: string;
  color: CoverColor;
  created_at: string;
  updated_at: string;
}

export interface Topic {
  id: string;
  notebook_id: string;
  name: string;
  color: TabColor;
  created_at: string;
}

export interface Note {
  id: string;
  notebook_id: string;
  topic_id: string | null;
  content: string;
  /** What you actually typed, kept when smart filing rewrote the note. */
  original: string | null;
  kind: NoteKind;
  pinned: boolean;
  sorted_by: SortedBy | null;
  created_at: string;
  updated_at: string;
}

export interface Data {
  notebooks: Notebook[];
  topics: Topic[];
  notes: Note[];
}

export const COVER_COLORS = ["ink", "oxblood", "forest", "ochre", "cobalt", "graphite", "teal", "plum"] as const;
export type CoverColor = (typeof COVER_COLORS)[number];

export const TAB_COLORS = ["manila", "sage", "sky", "clay", "plum", "mustard", "slate", "rose"] as const;
export type TabColor = (typeof TAB_COLORS)[number];
