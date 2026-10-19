import { describe, expect, it } from "vitest";
import type { Note, Topic } from "../types";
import { detectKind } from "./kind";
import { classify, extractHashtag, suggestTopics } from "./local";
import { stem } from "./text";

const topic = (id: string, name: string): Topic => ({
  id,
  name,
  notebook_id: "nb",
  color: "sage",
  created_at: "2026-01-01T00:00:00Z",
});

const note = (id: string, content: string, topic_id: string | null = null): Note => ({
  id,
  content,
  original: null,
  topic_id,
  notebook_id: "nb",
  kind: "fact",
  pinned: false,
  sorted_by: null,
  review: null,
  flag: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

describe("stem", () => {
  it("folds common suffixes", () => {
    expect(stem("cells")).toBe(stem("cell"));
    expect(stem("dividing")).toBe(stem("divide"));
    expect(stem("processes")).toBe("process");
    expect(stem("mitosis")).toBe("mitosis");
  });
});

describe("extractHashtag", () => {
  it("routes on the first hashtag and strips it", () => {
    expect(extractHashtag("#mitosis prophase comes first")).toEqual({ topic: "Mitosis", content: "prophase comes first" });
    expect(extractHashtag("ATP is energy #cell-biology")).toEqual({ topic: "Cell biology", content: "ATP is energy" });
  });
  it("keeps acronyms", () => {
    expect(extractHashtag("#DNA double helix").topic).toBe("DNA");
  });
  it("ignores text without hashtags", () => {
    expect(extractHashtag("  no tags here ")).toEqual({ topic: null, content: "no tags here" });
    expect(extractHashtag("issue#5 is fine").topic).toBeNull();
  });
});

describe("detectKind", () => {
  it.each([
    ["this will be on the test: krebs cycle", "exam"],
    ["Know this for the midterm", "exam"],
    ["hw: read chapter 4", "todo"],
    ["essay due friday", "todo"],
    ["why do leaves change color?", "question"],
    ["F = ma", "formula"],
    ["a^2 + b^2 = c^2", "formula"],
    ["Osmosis: diffusion of water across a membrane", "definition"],
    ["Mitochondria is the powerhouse of the cell", "definition"],
    ["Entropy refers to disorder", "definition"],
    ["Napoleon was exiled twice", "fact"],
  ])("%s → %s", (text, kind) => {
    expect(detectKind(text)).toBe(kind);
  });
});

describe("classify", () => {
  const topics = [topic("bio", "Photosynthesis"), topic("war", "World War I"), topic("cell", "Cell division")];
  const notes = [
    note("1", "chlorophyll absorbs red and blue light", "bio"),
    note("2", "light reactions happen in the thylakoid", "bio"),
    note("3", "trench warfare stalled the western front", "war"),
    note("4", "mitosis produces two identical cells", "cell"),
  ];

  it("matches on topic names", () => {
    expect(classify("photosynthesis makes glucose", topics, notes).topicId).toBe("bio");
  });
  it("learns from bits already filed", () => {
    expect(classify("thylakoid membranes stack into grana", topics, notes).topicId).toBe("bio");
    expect(classify("the western front barely moved", topics, notes).topicId).toBe("war");
    expect(classify("cells divide during mitosis", topics, notes).topicId).toBe("cell");
  });
  it("leaves unrelated bits loose", () => {
    expect(classify("bring a calculator", topics, notes).topicId).toBeNull();
  });
  it("handles empty input", () => {
    expect(classify("the and of", topics, notes).topicId).toBeNull();
    expect(classify("photosynthesis", [], []).topicId).toBeNull();
  });
});

describe("suggestTopics", () => {
  it("proposes recurring words as topics", () => {
    const loose = [
      note("a", "Enzymes lower activation energy"),
      note("b", "enzyme shape determines what it binds"),
      note("c", "temperature changes enzyme speed"),
      note("d", "bring a calculator"),
    ];
    const [first] = suggestTopics(loose, []);
    expect(first.name.toLowerCase()).toMatch(/^enzyme/);
    expect(first.noteIds.sort()).toEqual(["a", "b", "c"]);
  });
  it("skips words that already have a topic", () => {
    const loose = [note("a", "enzyme one"), note("b", "enzyme two")];
    expect(suggestTopics(loose, [topic("e", "Enzymes")])).toEqual([]);
  });
});
