// Smart filing through Puter.js (https://docs.puter.com): the person using the
// app signs in with their own Puter account and the AI usage comes out of their
// free allowance — no API key, no server.

import type { NoteKind } from "./types";
import { NOTE_KINDS } from "./types";

interface PuterChatResponse {
  message?: { content?: string | Array<{ type?: string; text?: string }> };
  toString(): string;
}

interface PuterModel {
  id: string;
  provider?: string;
  name?: string;
}

interface Puter {
  ai: {
    chat(messages: Array<{ role: string; content: string }>, options?: Record<string, unknown>): Promise<PuterChatResponse>;
    listModels?(provider?: string | null): Promise<PuterModel[] | { models?: PuterModel[] }>;
  };
  auth: {
    signIn(options?: Record<string, unknown>): Promise<unknown>;
    signOut(): Promise<void> | void;
    isSignedIn(): boolean | Promise<boolean>;
    getUser(): Promise<{ username?: string }>;
  };
}

declare global {
  interface Window {
    puter?: Puter;
  }
}

const SCRIPT = "https://js.puter.com/v2/";
let loading: Promise<Puter> | null = null;

export function loadPuter(): Promise<Puter> {
  if (window.puter) return Promise.resolve(window.puter);
  loading ??= new Promise<Puter>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.puter ? resolve(window.puter) : reject(new Error("Puter failed to start")));
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error("Couldn't load Puter — are you offline?"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Returns the Puter username if already signed in, without any popup. */
export async function puterSession(): Promise<string | null> {
  try {
    const puter = await loadPuter();
    if (!(await puter.auth.isSignedIn())) return null;
    const user = await puter.auth.getUser();
    return user?.username ?? "Puter user";
  } catch {
    return null;
  }
}

/** Must be called from a click — Puter opens a popup. */
export async function puterSignIn(): Promise<string> {
  const puter = await loadPuter();
  await puter.auth.signIn();
  const user = await puter.auth.getUser();
  return user?.username ?? "Puter user";
}

export async function puterSignOut() {
  const puter = await loadPuter();
  await puter.auth.signOut();
}

/* ───────────── model choice ─────────────
 * Two tiers keep it cheap: Haiku files and tidies every bit live during
 * class; every so often Sonnet reads back over the new bits and checks
 * Haiku's work (filing, faithfulness of rewrites, factual slips).
 */

export type Tier = "fast" | "smart";

const FALLBACK: Record<Tier, string> = { fast: "claude-haiku-4-5", smart: "claude-sonnet-5" };
const FAMILY: Record<Tier, string> = { fast: "claude-haiku", smart: "claude-sonnet" };

const versionOf = (id: string) => (id.match(/\d+/g) ?? []).map(Number);
function newer(a: string, b: string) {
  const va = versionOf(a);
  const vb = versionOf(b);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    if ((va[i] ?? 0) !== (vb[i] ?? 0)) return (vb[i] ?? 0) - (va[i] ?? 0);
  }
  return 0;
}

let modelsCache: Promise<string[]> | null = null;

/** Claude models Puter offers, grouped by family, newest first. */
export function claudeModels(): Promise<string[]> {
  modelsCache ??= (async () => {
    try {
      const puter = await loadPuter();
      const raw = await puter.ai.listModels?.();
      const list = Array.isArray(raw) ? raw : (raw?.models ?? []);
      const ids = list
        .map((m) => m.id)
        .filter((id) => /^claude-(opus|sonnet|haiku)-\d/.test(id) && !/latest|\d{8}/.test(id));
      const family = (id: string) => ["haiku", "sonnet", "opus"].findIndex((f) => id.includes(f));
      return [...new Set(ids)].sort((a, b) => family(a) - family(b) || newer(a, b));
    } catch {
      modelsCache = null;
      return [];
    }
  })();
  return modelsCache;
}

/** "auto" → the newest Haiku (fast) or Sonnet (smart) that Puter has. */
export async function resolveModel(tier: Tier, pref: string): Promise<string> {
  if (pref && pref !== "auto") return pref;
  const models = await claudeModels();
  return models.find((m) => m.startsWith(FAMILY[tier])) ?? FALLBACK[tier];
}

/* ───────────── shared bits ───────────── */

const REWRITE_RULES = `Fix typos, expand obvious shorthand, make it read clearly — but keep it as short as the original allows, keep the student's meaning, and never add facts they didn't write. Put all math, chemistry and units in LaTeX: $...$ inline, $$...$$ for a standalone equation (e.g. "$F = ma$", "$\\frac{dy}{dx}$", "$\\text{H}_2\\text{O}$", "$9.8\\,\\text{m/s}^2$"). Bold the term being defined with **term**.`;

const KINDS = `fact | definition | exam (teacher hinted it'll be tested, or flagged it as important) | todo (homework, deadlines, things to do) | question (something to look up or ask) | formula`;

const TOPIC_RULES = `the existing topic it belongs to, copied exactly. If none fits, make up a new topic name: 1–3 words, Title Case, naming the concept (e.g. "Cell Division", not "Mitosis Notes"). Reuse a new name you made up for other notes in this batch when they fit. Only use null for pure logistics with no subject matter ("bring a calculator").`;

const topicList = (topics: string[]) => (topics.length ? topics.map((t) => `- ${t}`).join("\n") : "(none yet)");

const nullableString = { type: ["string", "null"] };

function textOf(res: PuterChatResponse): string {
  const c = res?.message?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((b) => b.text ?? "").join("");
  return String(res ?? "");
}

async function ask(system: string, user: unknown, schema: object, tier: Tier, modelPref: string): Promise<unknown> {
  const puter = await loadPuter();
  const model = await resolveModel(tier, modelPref);
  const res = await puter.ai.chat(
    [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) },
    ],
    {
      model,
      normalize: true,
      max_tokens: 6000,
      outputFormat: { type: "json_schema", name: "notes", schema, strict: true },
    },
  );
  const text = textOf(res);
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const kindOf = (v: unknown): NoteKind => (NOTE_KINDS.includes(v as NoteKind) ? (v as NoteKind) : "fact");

/* ───────────── live filing (Haiku) ───────────── */

export interface FilingInput {
  notebook: string;
  topics: string[];
  notes: Array<{ id: string; content: string }>;
  rewrite: boolean;
}

export interface Assignment {
  id: string;
  topic: string | null;
  kind: NoteKind;
  rewrite: string | null;
}

const FILING_SCHEMA = {
  type: "object",
  properties: {
    assignments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          topic: nullableString,
          kind: { type: "string", enum: NOTE_KINDS },
          rewrite: nullableString,
        },
        required: ["id", "topic", "kind", "rewrite"],
        additionalProperties: false,
      },
    },
  },
  required: ["assignments"],
  additionalProperties: false,
};

function filingPrompt(input: FilingInput): string {
  return `You file a student's quick notes from class into their notebook "${input.notebook}".

Existing topics in this notebook:
${topicList(input.topics)}

For every note, return:
- topic: ${TOPIC_RULES}
- kind: ${KINDS}.
- rewrite: ${
    input.rewrite
      ? `a tidier version of the note for a clean notebook. ${REWRITE_RULES} Return null if the note is already clean and has no math to format.`
      : "always null."
  }

Answer with JSON matching the schema, one entry per note id.`;
}

export async function fileNotes(input: FilingInput, modelPref: string): Promise<Assignment[]> {
  const ids = new Set(input.notes.map((n) => n.id));
  const out = (await ask(filingPrompt(input), { notes: input.notes }, FILING_SCHEMA, "fast", modelPref)) as {
    assignments?: Array<Record<string, unknown>>;
  };
  if (!Array.isArray(out.assignments)) throw new Error("AI reply had no assignments");
  return out.assignments
    .filter((a) => typeof a?.id === "string" && ids.has(a.id))
    .map((a) => ({ id: a.id as string, topic: str(a.topic, 80), kind: kindOf(a.kind), rewrite: str(a.rewrite, 4000) }));
}

/* ───────────── review pass (Sonnet) ───────────── */

export interface ReviewInput {
  notebook: string;
  topics: string[];
  notes: Array<{ id: string; typed: string; current: string; topic: string | null; kind: NoteKind }>;
  rewrite: boolean;
}

export interface Correction {
  id: string;
  topic: string | null;
  kind: NoteKind;
  /** Replacement text, or null to keep the current text. */
  text: string | null;
  /** A short red-pen margin note when something looks factually off. */
  flag: string | null;
}

export interface Review {
  corrections: Correction[];
  merges: Array<{ from: string; into: string }>;
}

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    notes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          topic: nullableString,
          kind: { type: "string", enum: NOTE_KINDS },
          text: nullableString,
          flag: nullableString,
        },
        required: ["id", "topic", "kind", "text", "flag"],
        additionalProperties: false,
      },
    },
    merges: {
      type: "array",
      items: {
        type: "object",
        properties: { from: { type: "string" }, into: { type: "string" } },
        required: ["from", "into"],
        additionalProperties: false,
      },
    },
  },
  required: ["notes", "merges"],
  additionalProperties: false,
};

function reviewPrompt(input: ReviewInput): string {
  return `You're checking a student's class notebook "${input.notebook}". A faster assistant filed each note into a topic${
    input.rewrite ? " and tidied its wording" : ""
  } while the student was in class. Read back over its work.

Topics in this notebook:
${topicList(input.topics)}

Each note has "typed" (exactly what the student wrote), "current" (what's in the notebook now), its "topic" and "kind". For every note return:
- topic: is it in the right place? Return the correct topic — usually the current one. ${TOPIC_RULES}
- kind: ${KINDS}. Correct it if it's wrong.
- text: null if "current" is fine. Otherwise the corrected text — when the rewrite changed the student's meaning, invented something they didn't write, dropped something important, or has broken or missing LaTeX.${
    input.rewrite ? ` ${REWRITE_RULES}` : ` Keep it to the student's own words.`
  }
- flag: if the note states something that's factually wrong or very likely misheard (a wrong number, date, name, formula or definition), a short, kind correction in at most 20 words, like a teacher's note in the margin. Otherwise null. Don't flag opinions, shorthand, or things that are merely incomplete.

Also return merges: pairs of existing topics that are really the same subject and should be one ({"from": "Cell Cycle", "into": "Cell Division"}). Usually this is empty.

Answer with JSON matching the schema, one entry per note id.`;
}

export async function reviewNotes(input: ReviewInput, modelPref: string): Promise<Review> {
  const ids = new Set(input.notes.map((n) => n.id));
  const out = (await ask(reviewPrompt(input), { notes: input.notes }, REVIEW_SCHEMA, "smart", modelPref)) as {
    notes?: Array<Record<string, unknown>>;
    merges?: Array<Record<string, unknown>>;
  };
  if (!Array.isArray(out.notes)) throw new Error("AI reply had no notes");
  return {
    corrections: out.notes
      .filter((a) => typeof a?.id === "string" && ids.has(a.id))
      .map((a) => ({
        id: a.id as string,
        topic: str(a.topic, 80),
        kind: kindOf(a.kind),
        text: str(a.text, 4000),
        flag: str(a.flag, 240),
      })),
    merges: (out.merges ?? [])
      .map((m) => ({ from: str(m.from, 80) ?? "", into: str(m.into, 80) ?? "" }))
      .filter((m) => m.from && m.into && m.from !== m.into),
  };
}
