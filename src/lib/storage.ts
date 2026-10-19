// localStorage can throw (private mode, quota) — never let that take the app down.

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export interface Prefs {
  theme: "system" | "paper" | "chalk";
  /** Smart filing through Puter (needs a Puter sign-in). */
  smartFiling: boolean;
  /** Let smart filing tidy wording and typeset math. */
  rewrite: boolean;
  /** Claude model ids on Puter, or "auto" for the newest Haiku / Sonnet. */
  aiFast: string;
  aiSmart: string;
  /** Let Sonnet review new bits on its own (after a quiet spell or a dozen new bits). */
  autoReview: boolean;
  lastNotebookId: string | null;
}

const PREFS_KEY = "xnb:prefs";
const DEFAULT_PREFS: Prefs = { theme: "system", smartFiling: false, rewrite: true, aiFast: "auto", aiSmart: "auto", autoReview: true, lastNotebookId: null };

export function loadPrefs(): Prefs {
  return { ...DEFAULT_PREFS, ...readJSON<Partial<Prefs>>(PREFS_KEY, {}) };
}

export function savePrefs(p: Prefs) {
  writeJSON(PREFS_KEY, p);
}
