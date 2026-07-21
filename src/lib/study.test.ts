import { describe, expect, it } from "vitest";
import { hintFor, isCorrectAnswer, maskExample, normalizeAnswer, recordProgress } from "./study";
import type { WordEntry } from "./types";

const entry: WordEntry = {
  id: "organize",
  word: "organize",
  answers: ["organise"],
  zh: ["组织"],
  en: ["to arrange things"],
  examples: ["We need to organize the files."],
  source: { name: "test" },
};

describe("study helpers", () => {
  it("normalizes case, width and outer whitespace without removing word punctuation", () => {
    expect(normalizeAnswer("  ＯＲＧＡＮＩＺＥ  ")).toBe("organize");
    expect(normalizeAnswer("follow-up")).toBe("follow-up");
  });

  it("accepts declared spelling aliases", () => {
    expect(isCorrectAnswer("Organise", entry)).toBe(true);
    expect(isCorrectAnswer("org anise", entry)).toBe(false);
  });

  it("masks the answer and creates a useful hint", () => {
    expect(maskExample(entry.examples[0], entry)).toBe("We need to ______ the files.");
    expect(hintFor(entry)).toBe("O 开头 · 8 个字符");
  });

  it("accumulates correct and wrong attempts", () => {
    const progress = recordProgress(undefined, "workplace", { wordId: entry.id, result: "correct", wrongAttempts: 2 });
    expect(progress).toMatchObject({ correct: 1, wrong: 2, skipped: 0 });
  });
});
