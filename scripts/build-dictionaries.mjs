import { createWriteStream } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { parse } from "csv-parse";

const root = process.cwd();
const cacheDir = path.join(root, ".cache", "dictionaries");
const outputDir = path.join(root, "public", "data", "books");
const ecdictPath = path.join(cacheDir, "ecdict.csv");
const ecdictUrl = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv";
const stopWords = new Set(`a an and are as at be been being but by can could did do does doing down each even every for from get got had has have he her here him his how if in into is it its just may might more most much must no nor not now of on one only or other our out over same say she should so some such than that the their them then there these they this those through time to too under up us use very was way we well were what when where which while who why will with would year you your man part point area case find follow against however within state government`.split(" "));

const books = [
  {
    id: "workplace",
    name: "职场高频",
    description: "会议、沟通与日常协作中的高频英语",
    count: 300,
    accent: "sage",
    matches: (row) => /\[经\]/.test(row.translation) || /business|company|office|manag|meeting|project|customer|client|financ|market|contract|agreement|employee|career|profession|communicat|budget|salary|interview|commerce/i.test(row.definition),
  },
  {
    id: "cet4",
    name: "CET-4 核心",
    description: "大学英语四级高频核心词汇",
    count: 500,
    accent: "slate",
    matches: (row) => String(row.tag ?? "").split(/\s+/).includes("cet4"),
  },
  {
    id: "programmer",
    name: "程序员英语",
    description: "代码、产品与技术文档中的常见词汇",
    count: 300,
    accent: "sand",
    matches: (row) => /\[计\]/.test(row.translation) || /computer|software|hardware|programming|network|internet|database|server|website|algorithm|source code|digital device|operating system/i.test(row.definition),
  },
];

await mkdir(cacheDir, { recursive: true });
await mkdir(outputDir, { recursive: true });

try {
  await access(ecdictPath);
} catch {
  console.log("Downloading ECDICT…");
  const response = await fetch(ecdictUrl);
  if (!response.ok || !response.body) throw new Error(`ECDICT download failed: ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(ecdictPath));
}

const candidates = new Map(books.map((book) => [book.id, []]));
const parser = Readable.fromWeb(new Blob([await readFile(ecdictPath)]).stream()).pipe(
  parse({ columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true }),
);

for await (const row of parser) {
  const word = String(row.word ?? "").trim();
  const definition = String(row.definition ?? "").trim();
  const translation = String(row.translation ?? "").trim();
  if (!/^[a-z][a-z'-]{2,20}$/i.test(word) || word.includes(" ") || stopWords.has(word.toLowerCase()) || !definition || !translation) continue;
  const normalized = { ...row, word };
  for (const book of books) {
    if (book.matches(normalized)) candidates.get(book.id).push(normalized);
  }
}

const rank = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 999999;
};

function selectRows(book) {
  const rows = candidates.get(book.id);
  rows.sort((a, b) => Math.min(rank(a.bnc), rank(a.frq)) - Math.min(rank(b.bnc), rank(b.frq)) || a.word.localeCompare(b.word));
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.word.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, book.count);
}

function lines(value, limit = 2) {
  return String(value ?? "")
    .split(/\\n|\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function fallbackExample(word, pos) {
  if (/\b(v|vt|vi)\./i.test(pos)) return `We need to ${word} this before the next meeting.`;
  if (/\b(adj)\./i.test(pos)) return `The team found the result surprisingly ${word}.`;
  if (/\b(adv)\./i.test(pos)) return `The situation changed ${word} over time.`;
  return `The word ${word} came up during today's discussion.`;
}

const apiCachePath = path.join(cacheDir, "dictionary-api.json");
let apiCache = {};
try {
  apiCache = JSON.parse(await readFile(apiCachePath, "utf8"));
} catch {}

async function enrich(row) {
  const key = row.word.toLowerCase();
  if (!(key in apiCache)) {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`);
      apiCache[key] = response.ok ? await response.json() : null;
    } catch {
      apiCache[key] = null;
    }
  }
  const apiEntries = Array.isArray(apiCache[key]) ? apiCache[key] : [];
  const definitions = apiEntries.flatMap((entry) => entry.meanings ?? []).flatMap((meaning) => meaning.definitions ?? []);
  const apiDefinition = definitions.find((item) => item.definition)?.definition;
  const escapedWord = row.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const apiExample = definitions.find((item) => item.example && new RegExp(`\\b${escapedWord}\\b`, "i").test(item.example))?.example;
  const phonetics = apiEntries.flatMap((entry) => entry.phonetics ?? []);
  const audio = phonetics.find((item) => item.audio)?.audio;
  const phonetic = phonetics.find((item) => item.text)?.text || row.phonetic;
  return {
    id: key.replace(/[^a-z0-9]+/g, "-"),
    word: row.word,
    answers: [],
    zh: lines(row.translation),
    en: [apiDefinition || lines(row.definition, 1)[0]],
    examples: [apiExample || fallbackExample(row.word, row.pos)],
    phonetic: phonetic || undefined,
    audio: audio ? (audio.startsWith("//") ? `https:${audio}` : audio) : undefined,
    source: {
      name: apiDefinition || apiExample || audio ? "ECDICT + Free Dictionary API" : "ECDICT",
      url: "https://github.com/skywind3000/ECDICT",
      license: "MIT; pronunciation audio may use CC licenses listed by Dictionary API",
    },
  };
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const result = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      result[index] = await mapper(values[index]);
    }
  }));
  return result;
}

const manifest = [];
for (const book of books) {
  const selected = selectRows(book);
  if (selected.length !== book.count) throw new Error(`${book.id} only has ${selected.length} candidates`);
  console.log(`Enriching ${book.name}: ${selected.length} words…`);
  const words = await mapWithConcurrency(selected, 20, enrich);
  const payload = { ...book, builtIn: true, words };
  delete payload.matches;
  await writeFile(path.join(outputDir, `${book.id}.json`), JSON.stringify(payload));
  manifest.push({ id: book.id, name: book.name, description: book.description, count: words.length, builtIn: true, accent: book.accent });
  await writeFile(apiCachePath, JSON.stringify(apiCache));
}

await writeFile(path.join(root, "public", "data", "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("Dictionary build complete.");
