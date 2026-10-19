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
 * Two tiers keep it cheap: Haiku files every bit live during class, and
 * Sonnet only steps in for bits Haiku wasn't sure about, or when you ask
 * for a careful "polish" pass afterwards.
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

/* ───────────── filing + rewriting ───────────── */

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
  /** false → hand this one to the smarter model. */
  confident: boolean;
}

const SCHEMA = {
  type: "object",
  properties: {
    assignments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          topic: { type: ["string", "null"] },
          kind: { type: "string", enum: NOTE_KINDS },
          rewrite: { type: ["string", "null"] },
          confident: { type: "boolean" },
        },
        required: ["id", "topic", "kind", "rewrite", "confident"],
        additionalProperties: false,
      },
    },
  },
  required: ["assignments"],
  additionalProperties: false,
};

const REWRITE_RULES = `Fix typos, expand obvious shorthand, make it read clearly — but keep it as short as the original allows, keep the student's meaning, and never add facts they didn't write. Put all math, chemistry and units in LaTeX: $...$ inline, $$...$$ for a standalone equation (e.g. "$F = ma$", "$\\frac{dy}{dx}$", "$\\text{H}_2\\text{O}$", "$9.8\\,\\text{m/s}^2$"). Bold the term being defined with **term**.`;

function filingPrompt(input: FilingInput, tier: Tier): string {
  const topics = input.topics.length ? input.topics.map((t) => `- ${t}`).join("\n") : "(none yet)";
  return `You file a student's quick notes from class into their notebook "${input.notebook}".

Existing topics in this notebook:
${topics}

For every note, return:
- topic: the existing topic it belongs to, copied exactly. If none fits, make up a new topic name: 1–3 words, Title Case, naming the concept (e.g. "Cell Division", not "Mitosis Notes"). Reuse a new name you made up for other notes in this batch when they fit. Only use null for pure logistics with no subject matter ("bring a calculator").
- kind: fact | definition | exam (teacher hinted it'll be tested, or flagged it as important) | todo (homework, deadlines, things to do) | question (something to look up or ask) | formula.
${
  input.rewrite
    ? `- rewrite: a tidier version of the note for a clean notebook. ${REWRITE_RULES} Return null if the note is already clean and has no math to format.`
    : `- rewrite: always null.`
}
- confident: ${
    tier === "fast"
      ? "false if you're unsure which topic fits, the shorthand is ambiguous, or the note has math/notation you might typeset wrong; otherwise true."
      : "always true."
  }

Answer with JSON matching the schema, one entry per note id.`;
}

function polishPrompt(notebook: string): string {
  return `You're polishing a student's class notes from their notebook "${notebook}" so they're clear to study from later.

For every note, return:
- rewrite: the polished note. ${REWRITE_RULES} Return null if it's already as clear as it can be.
- topic, kind: copy them from the input unchanged.
- confident: true.

Answer with JSON matching the schema, one entry per note id.`;
}

function textOf(res: PuterChatResponse): string {
  const c = res?.message?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((b) => b.text ?? "").join("");
  return String(res ?? "");
}

function parseAssignments(text: string, ids: Set<string>): Assignment[] {
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json) as { assignments?: unknown };
  if (!Array.isArray(parsed.assignments)) throw new Error("AI reply had no assignments");
  const out: Assignment[] = [];
  for (const a of parsed.assignments as Array<Record<string, unknown>>) {
    if (typeof a?.id !== "string" || !ids.has(a.id)) continue;
    const topic = typeof a.topic === "string" && a.topic.trim() ? a.topic.trim().slice(0, 80) : null;
    const kind = NOTE_KINDS.includes(a.kind as NoteKind) ? (a.kind as NoteKind) : "fact";
    const rewrite = typeof a.rewrite === "string" && a.rewrite.trim() ? a.rewrite.trim().slice(0, 4000) : null;
    out.push({ id: a.id, topic, kind, rewrite, confident: a.confident !== false });
  }
  return out;
}

async function ask(system: string, user: unknown, tier: Tier, modelPref: string, ids: Set<string>): Promise<Assignment[]> {
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
      max_tokens: 4000,
      outputFormat: { type: "json_schema", name: "notes", schema: SCHEMA, strict: true },
    },
  );
  return parseAssignments(textOf(res), ids);
}

export function fileNotes(input: FilingInput, tier: Tier, modelPref: string): Promise<Assignment[]> {
  const ids = new Set(input.notes.map((n) => n.id));
  return ask(filingPrompt(input, tier), { notes: input.notes }, tier, modelPref, ids);
}

export function polishNotes(
  notebook: string,
  notes: Array<{ id: string; content: string; topic: string | null; kind: NoteKind }>,
  modelPref: string,
): Promise<Assignment[]> {
  const ids = new Set(notes.map((n) => n.id));
  return ask(polishPrompt(notebook), { notes }, "smart", modelPref, ids);
}
