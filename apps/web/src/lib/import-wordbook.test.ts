import { describe, expect, it } from "vitest";
import { parseWordBook } from "./import-wordbook";

describe("word book import", () => {
  it("imports a valid CSV and removes duplicate words", () => {
    const csv = "word,zh,en,example,phonetic,audio,aliases\nnegotiate,协商,to discuss,We negotiate today.,/n/, ,\nnegotiate,谈判,to discuss,They negotiate.,,,";
    const result = parseWordBook(csv, "office.csv");
    expect(result.book?.count).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("rejects incomplete rows instead of creating broken exercises", () => {
    const result = parseWordBook("word,zh,en,example\nhello,你好,,Hello there.", "broken.csv");
    expect(result.book).toBeUndefined();
    expect(result.errors[0]).toContain("en");
  });

  it("accepts the native JSON shape", () => {
    const json = JSON.stringify({ name: "Test", words: [{ word: "organize", zh: ["组织"], en: ["arrange"], examples: ["We organize files."], answers: ["organise"] }] });
    const result = parseWordBook(json, "test.json");
    expect(result.book?.name).toBe("Test");
    expect(result.book?.words[0].answers).toEqual(["organise"]);
  });
});
