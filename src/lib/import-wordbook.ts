import type { WordBook, WordEntry } from "./types";

export type ImportResult = {
  book?: WordBook;
  errors: string[];
  duplicates: number;
};

type RawRow = Record<string, unknown>;

function splitCell(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value ?? "")
    .split(/\s*[|；]\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toEntry(row: RawRow, line: number): { entry?: WordEntry; error?: string } {
  const word = String(row.word ?? "").trim();
  const zh = splitCell(row.zh);
  const en = splitCell(row.en);
  const examples = splitCell(row.example ?? row.examples);
  const missing = [!word && "word", !zh.length && "zh", !en.length && "en", !examples.length && "example"].filter(Boolean);
  if (missing.length) return { error: `第 ${line} 行缺少 ${missing.join("、")}` };
  const acceptableWords = [word, ...splitCell(row.aliases ?? row.answers)].map((item) => item.toLocaleLowerCase("en-US"));
  const hasMaskableExample = examples.some((example) => {
    const normalizedExample = example.toLocaleLowerCase("en-US");
    return acceptableWords.some((answer) => normalizedExample.includes(answer));
  });
  if (!hasMaskableExample) return { error: `第 ${line} 行的 example 必须包含单词或合法别名，才能自动挖空` };

  return {
    entry: {
      id: `custom-${word.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-")}`,
      word,
      answers: splitCell(row.aliases ?? row.answers),
      zh,
      en,
      examples,
      phonetic: String(row.phonetic ?? "").trim() || undefined,
      audio: String(row.audio ?? "").trim() || undefined,
      source: { name: "用户导入" },
    },
  };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      cells.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  cells.push(value);
  return cells;
}

function rowsFromCsv(content: string): RawRow[] {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) =>
    Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] ?? ""])),
  );
}

export function parseWordBook(content: string, fileName: string): ImportResult {
  let rows: RawRow[] = [];
  let name = fileName.replace(/\.(csv|json)$/i, "") || "自定义词本";
  try {
    if (fileName.toLowerCase().endsWith(".json")) {
      const parsed = JSON.parse(content) as RawRow[] | { name?: string; words?: RawRow[] };
      if (Array.isArray(parsed)) rows = parsed;
      else {
        name = String(parsed.name ?? name);
        rows = Array.isArray(parsed.words) ? parsed.words : [];
      }
    } else {
      rows = rowsFromCsv(content);
    }
  } catch {
    return { errors: ["文件无法解析，请检查 JSON 或 CSV 格式。"], duplicates: 0 };
  }

  const errors: string[] = [];
  const words: WordEntry[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  rows.forEach((row, index) => {
    const result = toEntry(row, index + 2);
    if (result.error) errors.push(result.error);
    if (!result.entry) return;
    const key = result.entry.word.toLocaleLowerCase("en-US");
    if (seen.has(key)) {
      duplicates += 1;
      return;
    }
    seen.add(key);
    words.push(result.entry);
  });

  if (!words.length) return { errors: errors.length ? errors : ["没有找到可导入的词条。"], duplicates };
  return {
    book: {
      id: `custom-${Date.now()}`,
      name,
      description: `${words.length} 个自定义词条`,
      count: words.length,
      builtIn: false,
      accent: "custom",
      words,
    },
    errors,
    duplicates,
  };
}
