import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { WordBook } from "./types";

const expected = {
  workplace: 300,
  cet4: 500,
  programmer: 300,
  "basic-850": 850,
  "cet4-full": 3846,
  cet6: 5403,
  kaoyan: 4801,
  "computer-english": 1760,
} as const;

describe("built-in dictionaries", () => {
  for (const [id, count] of Object.entries(expected)) {
    it(`${id} contains ${count} complete unique entries`, () => {
      const file = path.join(process.cwd(), "public", "data", "books", `${id}.json`);
      const book = JSON.parse(readFileSync(file, "utf8")) as WordBook;
      expect(book.words).toHaveLength(count);
      expect(new Set(book.words.map((word) => word.word.toLowerCase())).size).toBe(count);
      expect(new Set(book.words.map((word) => word.id)).size).toBe(count);
      for (const word of book.words) {
        expect(word.word).toBeTruthy();
        expect(word.zh[0]).toBeTruthy();
        expect(word.en[0]).toBeTruthy();
        expect(word.examples[0].toLowerCase()).toContain(word.word.toLowerCase());
      }
    });
  }

  it("basic-850 treats British and American spellings as aliases", () => {
    const file = path.join(process.cwd(), "public", "data", "books", "basic-850.json");
    const book = JSON.parse(readFileSync(file, "utf8")) as WordBook;
    expect(book.words.find((entry) => entry.word === "plough")?.answers).toContain("plow");
    expect(book.words.find((entry) => entry.word === "grey")?.answers).toContain("gray");
  });
});
