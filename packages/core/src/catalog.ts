import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WordBook, WordBookSummary } from "./types.js";

const dataDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/public-data");

export async function loadBookManifest(): Promise<WordBookSummary[]> {
  return JSON.parse(await readFile(path.join(dataDirectory, "manifest.json"), "utf8")) as WordBookSummary[];
}

export async function loadBuiltInBook(bookId: string): Promise<WordBook> {
  if (!/^[a-z0-9-]+$/.test(bookId)) throw new Error(`无效词本 ID：${bookId}`);
  try {
    return JSON.parse(await readFile(path.join(dataDirectory, "books", `${bookId}.json`), "utf8")) as WordBook;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`找不到词本：${bookId}`);
    throw error;
  }
}
