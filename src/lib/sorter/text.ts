// Small, dependency-free text helpers used by the on-device sorter.

const STOPWORDS = new Set(
  `a about above after again against all also am an and any are aren't as at be because been before being
  below between both but by can cannot could did do does doing don't down during each few for from further
  get gets got had has have having he her here hers herself him himself his how i if in into is isn't it its
  itself just let like lot me more most much must my myself no nor not now of off on once only or other our
  ours ourselves out over own really said same say says she should so some such than that the their theirs
  them themselves then there these they thing things this those through to too under until up us very was
  we were what when where which while who whom why will with would you your yours yourself yourselves
  one two also e.g i.e etc ok okay basically actually called means mean thing stuff use used using
  teacher prof professor class lecture today said says remember note notes test exam quiz important`
    .split(/\s+/)
    .filter(Boolean),
);

/** Very light stemmer — enough to match "cells"/"cell", "dividing"/"divide". */
export function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 6 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 5 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("es") && /(ss|x|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

export interface Token {
  stem: string;
  surface: string;
}

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const words = text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9][a-z0-9'-]*/g);
  if (!words) return out;
  for (const raw of words) {
    const surface = raw.replace(/^'+|'+$/g, "").replace(/'s$/, "");
    if (surface.length < 3 || STOPWORDS.has(surface) || /^\d+$/.test(surface)) continue;
    out.push({ stem: stem(surface), surface });
  }
  return out;
}

export function stems(text: string): string[] {
  return tokenize(text).map((t) => t.stem);
}

/** "cell-biology" / "cell_biology" → "Cell biology" */
export function prettifyTopicName(raw: string): string {
  const cleaned = raw.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  // Leave acronyms and mixed case alone ("DNA", "pH").
  if (cleaned !== cleaned.toLowerCase()) return cleaned;
  return cleaned[0].toUpperCase() + cleaned.slice(1);
}

export function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return norm(a) === norm(b);
}
