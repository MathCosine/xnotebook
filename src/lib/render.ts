// Notes are plain text with a little markdown (**bold**, *italic*, `code`)
// and LaTeX math ($inline$, $$display$$). KaTeX is loaded on first use so
// notebooks without math don't pay for it.

import { useSyncExternalStore } from "react";

type Katex = typeof import("katex").default;
let katex: Katex | null = null;
let loading = false;
const listeners = new Set<() => void>();

function loadKatex() {
  if (katex || loading) return;
  loading = true;
  void Promise.all([import("katex"), import("katex/dist/katex.min.css")]).then(([m]) => {
    katex = m.default;
    listeners.forEach((l) => l());
  });
}

/** Re-renders the caller once KaTeX has arrived. */
export function useKatexReady(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => katex !== null,
  );
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

function inline(escaped: string): string {
  return escaped
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/\n/g, "<br>");
}

// $$display$$, or $inline$ that doesn't start/end with a space and isn't
// followed by a digit — so "costs $5 and $10" stays plain text.
const MATH = /\$\$([\s\S]+?)\$\$|\$(?=\S)((?:\\.|[^$\\\n])+?)(?<=\S)\$(?!\d)/g;

export const hasMath = (text: string) => text.includes("$") && new RegExp(MATH.source).test(text);

export function renderNote(text: string): string {
  if (!hasMath(text)) return inline(escape(text));
  if (!katex) loadKatex();
  let html = "";
  let last = 0;
  for (const m of text.matchAll(MATH)) {
    const index = m.index ?? 0;
    html += inline(escape(text.slice(last, index)));
    const tex = m[1] ?? m[2];
    const display = m[1] !== undefined;
    html += katex
      ? katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: "ignore", trust: false, maxExpand: 200 })
      : `<code class="tex-pending">${escape(tex)}</code>`;
    last = index + m[0].length;
  }
  return html + inline(escape(text.slice(last)));
}

/** Plain text for search and previews: "$\frac{a}{b}$" stays readable enough. */
export function plainText(text: string): string {
  return text
    .replace(/\\(?:text|mathrm|mathbf|operatorname)\{([^}]*)\}/g, "$1")
    .replace(/\\(?:rightarrow|to)\b/g, "→")
    .replace(/\\(?:frac)\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}_^]|\*\*|`|\$\$?/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
