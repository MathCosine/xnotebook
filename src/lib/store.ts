import { useSyncExternalStore } from "react";
import { fileNotes, polishNotes, puterSession, puterSignIn, puterSignOut, type Assignment, type Tier } from "./ai";
import { supabase } from "./supabase";
import { loadPrefs, readJSON, removeKey, savePrefs, writeJSON, type Prefs } from "./storage";
import { detectKind } from "./sorter/kind";
import { classify, extractHashtag, type TopicSuggestion } from "./sorter/local";
import { sameName } from "./sorter/text";
import { toast } from "./toasts";
import {
  COVER_COLORS,
  TAB_COLORS,
  type CoverColor,
  type Data,
  type Note,
  type Notebook,
  type SortedBy,
  type TabColor,
  type Topic,
} from "./types";

/* ───────────────────────── state ───────────────────────── */

export type Scope = { kind: "local" } | { kind: "cloud"; userId: string; email: string | null };
export type SyncStatus = "idle" | "saving" | "offline";
export type PuterStatus = { state: "off" | "checking" | "signed-out" } | { state: "signed-in"; username: string };

export interface AppState {
  phase: "booting" | "signed-out" | "ready";
  scope: Scope;
  data: Data;
  sync: SyncStatus;
  /** Notes currently out with the AI sorter. */
  aiPending: ReadonlySet<string>;
  puter: PuterStatus;
  /** Arrived through a password-reset link: ask for a new password. */
  recovering: boolean;
  prefs: Prefs;
}

const EMPTY: Data = { notebooks: [], topics: [], notes: [] };

let state: AppState = {
  phase: "booting",
  scope: { kind: "local" },
  data: EMPTY,
  sync: "idle",
  aiPending: new Set(),
  puter: { state: "off" },
  recovering: false,
  prefs: loadPrefs(),
};

const listeners = new Set<() => void>();
function set(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useApp(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const getState = () => state;

/* ───────────────────────── ops ─────────────────────────
 * Every change is an op. Ops update the in-memory state immediately, get
 * written to a local snapshot, and (when signed in) queue in an outbox that
 * drains to Supabase. If class Wi-Fi drops, the outbox just waits.
 */

export type Op =
  | { t: "notebook"; row: Notebook }
  | { t: "notebook-del"; id: string }
  | { t: "topic"; row: Topic }
  | { t: "topic-del"; id: string }
  | { t: "note"; row: Note }
  | { t: "note-del"; id: string };

function upsertRow<T extends { id: string }>(list: T[], row: T): T[] {
  const i = list.findIndex((x) => x.id === row.id);
  if (i === -1) return [...list, row];
  const copy = list.slice();
  copy[i] = row;
  return copy;
}

export function applyOp(d: Data, op: Op): Data {
  switch (op.t) {
    case "notebook":
      return { ...d, notebooks: upsertRow(d.notebooks, op.row) };
    case "notebook-del":
      return {
        notebooks: d.notebooks.filter((n) => n.id !== op.id),
        topics: d.topics.filter((t) => t.notebook_id !== op.id),
        notes: d.notes.filter((n) => n.notebook_id !== op.id),
      };
    case "topic":
      return { ...d, topics: upsertRow(d.topics, op.row) };
    case "topic-del":
      return {
        ...d,
        topics: d.topics.filter((t) => t.id !== op.id),
        notes: d.notes.map((n) => (n.topic_id === op.id ? { ...n, topic_id: null } : n)),
      };
    case "note":
      return { ...d, notes: upsertRow(d.notes, op.row) };
    case "note-del":
      return { ...d, notes: d.notes.filter((n) => n.id !== op.id) };
  }
}

const scopeKey = (s: Scope) => (s.kind === "local" ? "local" : `u:${s.userId}`);
const dataKey = (s: Scope) => `xnb:data:${scopeKey(s)}`;
const outboxKey = (s: Scope) => `xnb:outbox:${scopeKey(s)}`;

let outbox: Op[] = [];
let version = 0;
let snapshotTimer: ReturnType<typeof setTimeout> | undefined;
let warnedQuota = false;

function persistSnapshot() {
  clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(flushSnapshot, 150);
}

function flushSnapshot() {
  clearTimeout(snapshotTimer);
  if (state.phase !== "ready") return;
  if (!writeJSON(dataKey(state.scope), state.data) && !warnedQuota) {
    warnedQuota = true;
    toast({ message: "This browser is out of storage space — export your notes soon.", tone: "error" }, 8000);
  }
}

function commit(ops: Op[]) {
  if (ops.length === 0) return;
  let data = state.data;
  for (const op of ops) data = applyOp(data, op);
  version++;
  set({ data });
  persistSnapshot();
  if (state.scope.kind === "cloud") {
    outbox.push(...ops);
    writeJSON(outboxKey(state.scope), outbox);
    void drain();
  }
}

/* ───────────────────────── cloud sync ───────────────────────── */

let draining = false;
let retryDelay = 2000;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

const isTransient = (status: number) => status === 0 || status === 401 || status === 408 || status === 429 || status >= 500;

async function send(op: Op): Promise<{ status: number; message?: string }> {
  if (!supabase) return { status: 200 };
  const res = await (() => {
    switch (op.t) {
      case "notebook":
        return supabase.from("notebooks").upsert(op.row);
      case "notebook-del":
        return supabase.from("notebooks").delete().eq("id", op.id);
      case "topic":
        return supabase.from("topics").upsert(op.row);
      case "topic-del":
        return supabase.from("topics").delete().eq("id", op.id);
      case "note":
        return supabase.from("notes").upsert(op.row);
      case "note-del":
        return supabase.from("notes").delete().eq("id", op.id);
    }
  })();
  return res.error ? { status: res.status || 0, message: res.error.message } : { status: res.status };
}

async function drain() {
  if (draining || state.scope.kind !== "cloud") return;
  const scope = state.scope;
  draining = true;
  set({ sync: "saving" });
  let dropped = false;
  while (outbox.length && state.scope === scope) {
    const op = outbox[0];
    let result: { status: number; message?: string };
    try {
      result = await send(op);
    } catch (e) {
      result = { status: 0, message: String(e) };
    }
    if (result.message && isTransient(result.status)) {
      set({ sync: "offline" });
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => void drain(), retryDelay);
      retryDelay = Math.min(retryDelay * 2, 60_000);
      draining = false;
      return;
    }
    if (result.message) {
      dropped = true;
      console.warn("xnotebook: change rejected", op, result.message);
    }
    outbox.shift();
    writeJSON(outboxKey(scope), outbox);
  }
  retryDelay = 2000;
  draining = false;
  if (state.scope === scope) set({ sync: "idle" });
  if (dropped) {
    toast({ message: "A change couldn't be saved, so I reloaded your notebooks.", tone: "error" });
    void refresh(true);
  }
}

async function fetchAll<T>(table: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase!.from(table).select("*").order("created_at").order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...(data as T[]));
    if (data.length < 1000) return out;
  }
}

let refreshing = false;
let lastRefresh = 0;

export async function refresh(force = false) {
  if (!supabase || state.scope.kind !== "cloud" || refreshing) return;
  if (!force && Date.now() - lastRefresh < 20_000) return;
  const scope = state.scope;
  const startVersion = version;
  refreshing = true;
  try {
    const [notebooks, topics, notes] = await Promise.all([
      fetchAll<Notebook>("notebooks"),
      fetchAll<Topic>("topics"),
      fetchAll<Note>("notes"),
    ]);
    lastRefresh = Date.now();
    // Something changed locally mid-fetch — the server copy may be stale; try again later.
    if (state.scope !== scope || version !== startVersion) return;
    let data: Data = { notebooks, topics, notes };
    for (const op of outbox) data = applyOp(data, op);
    set({ data });
    flushSnapshot();
  } catch (e) {
    console.warn("xnotebook: refresh failed", e);
    if (state.scope === scope && outbox.length === 0) set({ sync: "offline" });
  } finally {
    refreshing = false;
  }
}

/* ───────────────────────── session ───────────────────────── */

const MODE_KEY = "xnb:mode";

function enterScope(scope: Scope) {
  flushSnapshot();
  clearTimeout(retryTimer);
  outbox = scope.kind === "cloud" ? readJSON<Op[]>(outboxKey(scope), []) : [];
  version++;
  set({
    phase: "ready",
    scope,
    data: readJSON<Data>(dataKey(scope), EMPTY),
    sync: "idle",
    aiPending: new Set(),
  });
  if (scope.kind === "cloud") {
    void refresh(true);
    void drain();
  }
}

export async function boot() {
  if (state.prefs.smartFiling) void checkPuter();
  if (!supabase) {
    enterScope({ kind: "local" });
    return;
  }
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (user) enterScope({ kind: "cloud", userId: user.id, email: user.email ?? null });
  else if (readJSON<string>(MODE_KEY, "") === "local") enterScope({ kind: "local" });
  else set({ phase: "signed-out" });

  // Clean the ?code=… left over from a magic-link sign-in.
  if (location.search.includes("code=")) history.replaceState(null, "", location.pathname + location.hash);

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") set({ recovering: true });
    const u = session?.user;
    if (u && (state.scope.kind !== "cloud" || state.scope.userId !== u.id)) {
      writeJSON(MODE_KEY, "cloud");
      enterScope({ kind: "cloud", userId: u.id, email: u.email ?? null });
    } else if (event === "SIGNED_OUT") {
      set({ phase: "signed-out", data: EMPTY, scope: { kind: "local" } });
    }
  });

  const onWake = () => {
    if (document.visibilityState === "visible") {
      void drain();
      void refresh();
    }
  };
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("online", () => {
    retryDelay = 2000;
    void drain();
    void refresh(true);
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushSnapshot);
}

export function useThisDeviceOnly() {
  writeJSON(MODE_KEY, "local");
  enterScope({ kind: "local" });
}

export function goToSignIn() {
  flushSnapshot();
  set({ phase: "signed-out" });
}

const NOT_SET_UP = "Sync isn't set up for this copy of the app.";
const redirectTo = () => location.origin + location.pathname;

/** Returns an error message, or null on success. */
export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return NOT_SET_UP;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

/** Returns "confirm" when Supabase wants the email confirmed first. */
export async function signUp(email: string, password: string): Promise<string | null | "confirm"> {
  if (!supabase) return NOT_SET_UP;
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
  if (error) return error.message;
  return data.session ? null : "confirm";
}

export async function sendPasswordReset(email: string): Promise<string | null> {
  if (!supabase) return NOT_SET_UP;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
  return error ? error.message : null;
}

export async function setNewPassword(password: string): Promise<string | null> {
  if (!supabase) return NOT_SET_UP;
  const { error } = await supabase.auth.updateUser({ password });
  if (!error) set({ recovering: false });
  return error ? error.message : null;
}

export const dismissRecovery = () => set({ recovering: false });

export async function signOut() {
  if (!supabase) return;
  if (outbox.length && !confirm(`${outbox.length} change(s) haven't reached the cloud yet. Sign out anyway?`)) return;
  const scope = state.scope;
  await supabase.auth.signOut();
  removeKey(dataKey(scope));
  removeKey(outboxKey(scope));
  outbox = [];
  writeJSON(MODE_KEY, "");
}

export function pendingChanges() {
  return outbox.length;
}

/** Notebooks sitting in this browser's "this device only" storage. */
export function localOnlyData(): Data {
  return readJSON<Data>(dataKey({ kind: "local" }), EMPTY);
}

export function importLocalIntoAccount(): number {
  if (state.scope.kind !== "cloud") return 0;
  const local = localOnlyData();
  const ops: Op[] = [
    ...local.notebooks.map((row): Op => ({ t: "notebook", row })),
    ...local.topics.map((row): Op => ({ t: "topic", row })),
    ...local.notes.map((row): Op => ({ t: "note", row })),
  ];
  commit(ops);
  removeKey(dataKey({ kind: "local" }));
  return local.notebooks.length;
}

/* ───────────────────────── prefs ───────────────────────── */

export function setPrefs(patch: Partial<Prefs>) {
  const prefs = { ...state.prefs, ...patch };
  savePrefs(prefs);
  set({ prefs });
}

const smartFilingOn = () => state.prefs.smartFiling && state.puter.state === "signed-in";

async function checkPuter() {
  set({ puter: { state: "checking" } });
  const username = await puterSession();
  set({ puter: username ? { state: "signed-in", username } : { state: "signed-out" } });
}

/** Call from a click: Puter opens a sign-in popup. */
export async function connectPuter(): Promise<string | null> {
  try {
    const username = await puterSignIn();
    set({ puter: { state: "signed-in", username } });
    setPrefs({ smartFiling: true });
    return null;
  } catch (e) {
    const err = e as { msg?: string; message?: string; error?: string };
    if (err?.error === "auth_window_closed") return null;
    if (err?.error === "popup_blocked") return "Your browser blocked the Puter popup — allow popups for this site and try again.";
    return err?.msg ?? err?.message ?? "Couldn't connect to Puter.";
  }
}

export async function disconnectPuter() {
  setPrefs({ smartFiling: false });
  set({ puter: { state: "signed-out" } });
  try {
    await puterSignOut();
  } catch {
    /* already signed out */
  }
}

export function setSmartFiling(on: boolean) {
  setPrefs({ smartFiling: on });
  if (on && state.puter.state === "off") void checkPuter();
}

/* ───────────────────────── helpers ───────────────────────── */

export function uid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // crypto.randomUUID is missing on plain-http LAN dev servers.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const now = () => new Date().toISOString();

function leastUsed<C extends string>(palette: readonly C[], used: C[]): C {
  const counts = new Map<C, number>(palette.map((c) => [c, 0]));
  used.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0];
}

const topicsOf = (notebookId: string) => state.data.topics.filter((t) => t.notebook_id === notebookId);
const notesOf = (notebookId: string) => state.data.notes.filter((n) => n.notebook_id === notebookId);

function makeTopic(notebookId: string, name: string): Topic {
  return {
    id: uid(),
    notebook_id: notebookId,
    name: name.trim().slice(0, 80),
    color: leastUsed(TAB_COLORS, topicsOf(notebookId).map((t) => t.color)),
    created_at: now(),
  };
}

/* ───────────────────────── notebooks ───────────────────────── */

export function createNotebook(name: string): Notebook {
  const t = now();
  const nb: Notebook = {
    id: uid(),
    name: name.trim().slice(0, 120) || "Untitled notebook",
    color: leastUsed(COVER_COLORS, state.data.notebooks.map((n) => n.color)),
    created_at: t,
    updated_at: t,
  };
  commit([{ t: "notebook", row: nb }]);
  return nb;
}

export function updateNotebook(id: string, patch: Partial<Pick<Notebook, "name" | "color">>) {
  const nb = state.data.notebooks.find((n) => n.id === id);
  if (!nb) return;
  commit([{ t: "notebook", row: { ...nb, ...patch, updated_at: now() } }]);
}

export function deleteNotebook(id: string) {
  commit([{ t: "notebook-del", id }]);
}

/* ───────────────────────── topics ───────────────────────── */

export function findOrCreateTopic(notebookId: string, name: string): Topic {
  const existing = topicsOf(notebookId).find((t) => sameName(t.name, name));
  if (existing) return existing;
  const topic = makeTopic(notebookId, name);
  commit([{ t: "topic", row: topic }]);
  return topic;
}

export function updateTopic(id: string, patch: Partial<Pick<Topic, "name" | "color">>) {
  const t = state.data.topics.find((x) => x.id === id);
  if (!t) return;
  commit([{ t: "topic", row: { ...t, ...patch } }]);
}

/** Notes fall back into Loose leaf. */
export function deleteTopic(id: string) {
  commit([{ t: "topic-del", id }]);
}

export function mergeTopic(fromId: string, intoId: string) {
  const ops: Op[] = state.data.notes
    .filter((n) => n.topic_id === fromId)
    .map((n) => ({ t: "note", row: { ...n, topic_id: intoId, updated_at: now() } }));
  ops.push({ t: "topic-del", id: fromId });
  commit(ops);
}

/* ───────────────────────── notes ───────────────────────── */

export interface JotResult {
  note: Note;
  topic: Topic | null;
  via: "hashtag" | "auto" | "loose";
}

/** The main event: a raw bit goes in, gets a kind and (ideally) a topic. */
export function jot(notebookId: string, raw: string): JotResult | null {
  const text = raw.trim();
  if (!text) return null;
  const { topic: tag, content } = extractHashtag(text);
  const ops: Op[] = [];
  let topic: Topic | null = null;
  let sortedBy: SortedBy | null = null;

  if (tag) {
    topic = topicsOf(notebookId).find((t) => sameName(t.name, tag)) ?? null;
    if (!topic) {
      topic = makeTopic(notebookId, tag);
      ops.push({ t: "topic", row: topic });
    }
    sortedBy = "you";
  } else {
    const topics = topicsOf(notebookId);
    const { topicId } = classify(content, topics, notesOf(notebookId));
    topic = topics.find((t) => t.id === topicId) ?? null;
    if (topic) sortedBy = "auto";
  }

  const t = now();
  const note: Note = {
    id: uid(),
    notebook_id: notebookId,
    topic_id: topic?.id ?? null,
    content: content.slice(0, 4000),
    original: null,
    kind: detectKind(content),
    pinned: false,
    sorted_by: sortedBy,
    created_at: t,
    updated_at: t,
  };
  ops.push({ t: "note", row: note });
  commit(ops);
  if (smartFilingOn() && (!tag || state.prefs.rewrite)) queueSmartFiling([note.id]);
  return { note, topic, via: tag ? "hashtag" : topic ? "auto" : "loose" };
}

export function updateNote(id: string, patch: Partial<Pick<Note, "content" | "kind" | "pinned" | "original">>) {
  const n = state.data.notes.find((x) => x.id === id);
  if (!n) return;
  commit([{ t: "note", row: { ...n, ...patch, updated_at: now() } }]);
}

export function moveNote(id: string, topicId: string | null) {
  const n = state.data.notes.find((x) => x.id === id);
  if (!n) return;
  commit([{ t: "note", row: { ...n, topic_id: topicId, sorted_by: "you", updated_at: now() } }]);
}

export function deleteNote(id: string): Note | undefined {
  const n = state.data.notes.find((x) => x.id === id);
  if (n) commit([{ t: "note-del", id }]);
  return n;
}

export function restoreNote(note: Note) {
  const topicExists = note.topic_id === null || state.data.topics.some((t) => t.id === note.topic_id);
  commit([{ t: "note", row: topicExists ? note : { ...note, topic_id: null } }]);
}

export function acceptSuggestion(notebookId: string, s: TopicSuggestion) {
  const topic = findOrCreateTopic(notebookId, s.name);
  const ops: Op[] = state.data.notes
    .filter((n) => s.noteIds.includes(n.id))
    .map((n) => ({ t: "note", row: { ...n, topic_id: topic.id, sorted_by: "auto", updated_at: now() } }));
  commit(ops);
}

/**
 * Re-file everything in Loose leaf. Uses Claude when smart filing is on,
 * otherwise re-runs the on-device sorter (which may know more by now).
 */
export function refileLoose(notebookId: string): number | "smart" {
  const loose = notesOf(notebookId).filter((n) => n.topic_id === null);
  if (loose.length === 0) return 0;
  if (smartFilingOn()) {
    queueSmartFiling(loose.map((n) => n.id), 0);
    return "smart";
  }
  const topics = topicsOf(notebookId);
  const filed = notesOf(notebookId).filter((n) => n.topic_id);
  const ops: Op[] = [];
  for (const n of loose) {
    const { topicId } = classify(n.content, topics, filed);
    if (topicId) ops.push({ t: "note", row: { ...n, topic_id: topicId, sorted_by: "auto", updated_at: now() } });
  }
  commit(ops);
  return ops.length;
}

/* ───────────────────────── smart filing (Claude via Puter) ─────────────────────────
 * Haiku files every bit a moment after you jot it (batched, so a burst of
 * jots is one request). Bits Haiku isn't sure about get a second look from
 * Sonnet. "Polish" sends a whole topic to Sonnet for a careful rewrite.
 */

const aiQueue = new Set<string>();
let aiTimer: ReturnType<typeof setTimeout> | undefined;
let aiRunning = false;
let warnedAi = false;

function markPending(ids: string[], on: boolean) {
  const pending = new Set(state.aiPending);
  ids.forEach((id) => (on ? pending.add(id) : pending.delete(id)));
  set({ aiPending: pending });
}

function queueSmartFiling(ids: string[], delay = 1200) {
  ids.forEach((id) => aiQueue.add(id));
  markPending(ids, true);
  clearTimeout(aiTimer);
  aiTimer = setTimeout(() => void runSmartFiling(), delay);
}

function warnAi(e: unknown) {
  console.warn("smart filing failed", e);
  if (warnedAi) return;
  warnedAi = true;
  toast({ message: "Smart filing didn't answer — kept on-device sorting for now.", tone: "error" });
}

function groupByNotebook(ids: string[]): Map<string, Note[]> {
  const out = new Map<string, Note[]>();
  for (const id of ids) {
    const n = state.data.notes.find((x) => x.id === id);
    if (n) out.set(n.notebook_id, [...(out.get(n.notebook_id) ?? []), n]);
  }
  return out;
}

async function fileBatch(notebookId: string, notes: Note[], tier: Tier): Promise<string[]> {
  const notebook = state.data.notebooks.find((n) => n.id === notebookId);
  const sent = new Map(notes.map((n) => [n.id, n.content]));
  const assignments = await fileNotes(
    {
      notebook: notebook?.name ?? "",
      topics: topicsOf(notebookId).map((t) => t.name),
      notes: notes.map((n) => ({ id: n.id, content: n.original ?? n.content })),
      rewrite: state.prefs.rewrite,
    },
    tier,
    tier === "fast" ? state.prefs.aiFast : state.prefs.aiSmart,
  );
  applyAssignments(notebookId, assignments, sent);
  return assignments.filter((a) => !a.confident).map((a) => a.id);
}

async function runSmartFiling() {
  if (aiRunning) {
    aiTimer = setTimeout(() => void runSmartFiling(), 800);
    return;
  }
  const ids = [...aiQueue];
  aiQueue.clear();
  if (ids.length === 0) return;
  aiRunning = true;
  try {
    for (const [notebookId, notes] of groupByNotebook(ids)) {
      for (let i = 0; i < notes.length; i += 25) {
        const unsure = await fileBatch(notebookId, notes.slice(i, i + 25), "fast");
        if (unsure.length) {
          const second = unsure.map((id) => state.data.notes.find((n) => n.id === id)).filter((n): n is Note => !!n);
          await fileBatch(notebookId, second, "smart");
        }
      }
    }
  } catch (e) {
    warnAi(e);
  } finally {
    aiRunning = false;
    markPending(ids, false);
  }
}

/** Careful Sonnet rewrite of the given notes (clarity + LaTeX). Keeps topics as they are. */
export async function polish(noteIds: string[]): Promise<number> {
  if (state.puter.state !== "signed-in" || noteIds.length === 0) return 0;
  markPending(noteIds, true);
  let changed = 0;
  try {
    for (const [notebookId, notes] of groupByNotebook(noteIds)) {
      const notebook = state.data.notebooks.find((n) => n.id === notebookId);
      for (let i = 0; i < notes.length; i += 20) {
        const chunk = notes.slice(i, i + 20);
        const sent = new Map(chunk.map((n) => [n.id, n.content]));
        const topicName = (id: string | null) => state.data.topics.find((t) => t.id === id)?.name ?? null;
        const result = await polishNotes(
          notebook?.name ?? "",
          chunk.map((n) => ({ id: n.id, content: n.content, topic: topicName(n.topic_id), kind: n.kind })),
          state.prefs.aiSmart,
        );
        const ops: Op[] = [];
        for (const a of result) {
          const n = state.data.notes.find((x) => x.id === a.id);
          if (!n || !a.rewrite || a.rewrite === n.content || sent.get(n.id) !== n.content) continue;
          ops.push({ t: "note", row: { ...n, content: a.rewrite, original: n.original ?? n.content, updated_at: now() } });
        }
        commit(ops);
        changed += ops.length;
      }
    }
  } catch (e) {
    warnAi(e);
  } finally {
    markPending(noteIds, false);
  }
  return changed;
}

/**
 * @param sent each note's content when it was sent off — if you edited it
 * since, Claude's rewrite is dropped so your edit wins.
 */
function applyAssignments(notebookId: string, assignments: Assignment[], sent: Map<string, string>) {
  const ops: Op[] = [];
  const newTopics = new Map<string, Topic>();
  for (const a of assignments) {
    const n = state.data.notes.find((x) => x.id === a.id);
    if (!n) continue;
    let topicId = n.topic_id;
    // Bits you filed by hand (or with #topic) stay where you put them.
    if (n.sorted_by !== "you" && a.topic) {
      const name = a.topic.trim();
      const existing = topicsOf(notebookId).find((t) => sameName(t.name, name)) ?? newTopics.get(name.toLowerCase());
      if (existing) topicId = existing.id;
      else {
        const topic = makeTopic(notebookId, name);
        // makeTopic only sees committed topics; offset so one batch doesn't reuse a colour.
        topic.color = TAB_COLORS[(topicsOf(notebookId).length + newTopics.size) % TAB_COLORS.length] as TabColor;
        newTopics.set(name.toLowerCase(), topic);
        ops.push({ t: "topic", row: topic });
        topicId = topic.id;
      }
    }
    const unchanged = sent.get(n.id) === n.content;
    const rewrite = unchanged && a.rewrite && a.rewrite !== n.content ? a.rewrite : null;
    if (topicId === n.topic_id && a.kind === n.kind && !rewrite) continue;
    ops.push({
      t: "note",
      row: {
        ...n,
        topic_id: topicId,
        kind: a.kind,
        sorted_by: topicId !== n.topic_id ? "ai" : n.sorted_by,
        content: rewrite ?? n.content,
        original: rewrite ? (n.original ?? n.content) : n.original,
        updated_at: now(),
      },
    });
  }
  commit(ops);
}

/* ───────────────────────── misc ───────────────────────── */

export function coverFor(notebookId: string): CoverColor {
  return state.data.notebooks.find((n) => n.id === notebookId)?.color ?? "ink";
}
