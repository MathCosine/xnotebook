import type { NoteKind } from "../types";

const EXAM = /\b(on|for|in) (the |our |next )?(test|exam|quiz|final|midterm)s?\b|\bwill be (tested|on)\b|\b(know|remember|memori[sz]e) this\b|\bimportant\b|!!/i;
const TODO = /^(todo|to-do|to do|hw|homework|due|read|finish|submit|study|review|bring|email|ask)\b|\b(due|deadline)\b|\bassignment\b|\bpset\b/i;
const QUESTION_START = /^(why|how|what|who|when|where|which|is|are|does|do|can|could|should|would)\b/i;
const FORMULA = /[=≈≤≥∑∫√π±×÷^]|\b[a-z]\s*[+\-*/]\s*[a-z0-9]\b|\b\w+\(\w+\)\s*=/i;
const DEFINITION =
  /^[^:=—–\-]{1,48}\s*(:|—|–|\s-\s)\s*\S|\b(is defined as|means|refers to|is called|stands for|is the term for|is when)\b|^(a|an|the)?\s*[\w\s'-]{1,40}?\s+(is|are)\s+(a|an|the|when)\b/i;

/** Guess what kind of thing was jotted down. Order matters: the most useful signal wins. */
export function detectKind(text: string): NoteKind {
  const t = text.trim();
  if (EXAM.test(t)) return "exam";
  if (TODO.test(t)) return "todo";
  if (t.endsWith("?") || (QUESTION_START.test(t) && t.split(/\s+/).length <= 8 && !/[.:]/.test(t))) return "question";
  if (FORMULA.test(t) && !/^https?:/.test(t)) {
    // "x = y" style definitions written as words are still definitions.
    const lhs = t.split("=")[0] ?? "";
    if (!(t.includes("=") && /[a-z]{4,}\s+[a-z]{4,}/i.test(t) && lhs.trim().split(/\s+/).length > 3)) return "formula";
  }
  if (DEFINITION.test(t)) return "definition";
  return "fact";
}
