import { describe, expect, it } from "vitest";
import { answerPractice, emptyLearnerState, skipPractice, startPractice } from "./learner.js";
import type { WordBook } from "./types.js";

const book: WordBook = {
  id: "test-book",
  name: "测试词本",
  description: "test",
  count: 1,
  builtIn: true,
  accent: "sage",
  words: [{
    id: "organize",
    word: "organize",
    answers: ["organise"],
    zh: ["组织"],
    en: ["to arrange things"],
    examples: ["We need to organize the files."],
    source: { name: "test" },
  }],
};

describe("learner state", () => {
  it("keeps wrong attempts and progress consistent with the web flow", () => {
    const started = startPractice(emptyLearnerState(), book, "all");
    const wrong = answerPractice(started.state, book, "organization");
    const correct = answerPractice(wrong.state, book, "organise");

    expect(wrong.prompt?.wrongAttempts).toBe(1);
    expect(correct.completed).toBe(true);
    expect(correct.state.progress[0]).toMatchObject({ correct: 1, wrong: 1, skipped: 0 });
  });

  it("records skips and resumes unfinished sessions", () => {
    const started = startPractice(emptyLearnerState(), book, "all");
    const resumed = startPractice(started.state, book, "all");
    const skipped = skipPractice(resumed.state, book);

    expect(resumed.resumed).toBe(true);
    expect(skipped.state.progress[0]).toMatchObject({ correct: 0, wrong: 0, skipped: 1 });
  });
});
