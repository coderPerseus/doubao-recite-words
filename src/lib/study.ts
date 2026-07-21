import type { SessionResult, StudySession, WordEntry, WordProgress } from "./types";

export function normalizeAnswer(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

export function isCorrectAnswer(value: string, entry: WordEntry): boolean {
  const normalized = normalizeAnswer(value);
  return [entry.word, ...entry.answers].some((answer) => normalizeAnswer(answer) === normalized);
}

export function shuffle<T>(values: T[], random = Math.random): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function createSession(bookId: string, wordIds: string[], size: number | "all"): StudySession {
  const queue = shuffle(wordIds).slice(0, size === "all" ? wordIds.length : size);
  return {
    id: crypto.randomUUID(),
    bookId,
    queue,
    index: 0,
    results: [],
    wrongAttempts: 0,
    startedAt: new Date().toISOString(),
  };
}

export function recordProgress(
  current: WordProgress | undefined,
  bookId: string,
  result: SessionResult,
): WordProgress {
  return {
    bookId,
    wordId: result.wordId,
    correct: (current?.correct ?? 0) + (result.result === "correct" ? 1 : 0),
    wrong: (current?.wrong ?? 0) + result.wrongAttempts,
    skipped: (current?.skipped ?? 0) + (result.result === "skipped" ? 1 : 0),
    lastSeenAt: new Date().toISOString(),
  };
}

export function hintFor(entry: WordEntry): string {
  const characters = Array.from(entry.word);
  return `${characters[0]?.toUpperCase() ?? ""} 开头 · ${characters.length} 个字符`;
}

export function maskExample(example: string, entry: WordEntry): string {
  const candidates = [entry.word, ...entry.answers]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!candidates.length) return example;
  const masked = example.replace(new RegExp(`\\b(${candidates.join("|")})\\b`, "gi"), "______");
  return masked === example ? `${example}  (______ )` : masked;
}
