import { createWriteStream } from "node:fs";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { parse } from "csv-parse";

const root = process.cwd();
const cacheDir = path.join(root, ".cache", "dictionaries");
const dataDir = path.join(root, "packages", "core", "data", "public-data");
const outputDir = path.join(dataDir, "books");
const ecdictPath = path.join(cacheDir, "ecdict.csv");
const ecdictUrl = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv";
const basicEnglishUrl = "https://gist.githubusercontent.com/eduellery/b82de59c04519b01b37f07d73360707e/raw/basic-english-850-words.txt";
const qwertyBaseUrl = "https://raw.githubusercontent.com/RealKai42/qwerty-learner/master/public/dicts";
const examExampleArchives = [
  ["CET4_3", "https://raw.githubusercontent.com/kajweb/dict/master/book/1521164643060_CET4_3.zip"],
  ["CET6_3", "https://raw.githubusercontent.com/kajweb/dict/master/book/1521164633851_CET6_3.zip"],
  ["KaoYan_3", "https://raw.githubusercontent.com/kajweb/dict/master/book/1521164658897_KaoYan_3.zip"],
];
const stopWords = new Set(`a an and are as at be been being but by can could did do does doing down each even every for from get got had has have he her here him his how if in into is it its just may might more most much must no nor not now of on one only or other our out over same say she should so some such than that the their them then there these they this those through time to too under up us use very was way we well were what when where which while who why will with would year you your man part point area case find follow against however within state government`.split(" "));

const books = [
  {
    id: "workplace",
    name: "职场高频",
    description: "会议、沟通与日常协作中的高频英语",
    count: 300,
    accent: "sage",
    mode: "ranked",
    matches: (row) => /\[经\]/.test(row.translation) || /business|company|office|manag|meeting|project|customer|client|financ|market|contract|agreement|employee|career|profession|communicat|budget|salary|interview|commerce/i.test(row.definition),
  },
  {
    id: "cet4",
    name: "CET-4 核心",
    description: "大学英语四级高频核心词汇",
    count: 500,
    accent: "slate",
    mode: "ranked",
    matches: (row) => String(row.tag ?? "").split(/\s+/).includes("cet4"),
  },
  {
    id: "programmer",
    name: "程序员英语",
    description: "代码、产品与技术文档中的常见词汇",
    count: 300,
    accent: "sand",
    mode: "ranked",
    matches: (row) => /\[计\]/.test(row.translation) || /computer|software|hardware|programming|network|internet|database|server|website|algorithm|source code|digital device|operating system/i.test(row.definition),
  },
  {
    id: "basic-850",
    name: "Basic English 850",
    description: "Ogden 基础英语核心词汇，包含英美拼写别名",
    count: 850,
    accent: "sage",
    mode: "basic",
  },
  {
    id: "cet4-full",
    name: "CET-4 完整",
    description: "ECDICT 四级大纲词汇，已清理缺失释义的异常词条",
    count: 3846,
    accent: "slate",
    mode: "tag",
    tag: "cet4",
  },
  {
    id: "cet6",
    name: "CET-6 完整",
    description: "ECDICT 六级大纲词汇，包含四级基础词汇",
    count: 5403,
    accent: "slate",
    mode: "tag",
    tag: "cet6",
  },
  {
    id: "kaoyan",
    name: "考研英语",
    description: "研究生英语入学考试大纲词汇",
    count: 4801,
    accent: "sand",
    mode: "tag",
    tag: "ky",
  },
  {
    id: "computer-english",
    name: "计算机英语",
    description: "合并计算机专用英语与 Coder Dict，去重并清理异常词条",
    count: 1760,
    accent: "sand",
    mode: "computer",
  },
];
const manifestOrder = [
  "basic-850",
  "cet4-full",
  "cet6",
  "kaoyan",
  "computer-english",
  "workplace",
  "cet4",
  "programmer",
];

await mkdir(cacheDir, { recursive: true });
await mkdir(outputDir, { recursive: true });

async function downloadFile(url, file) {
  try {
    await access(file);
  } catch {
    console.log(`Downloading ${path.basename(file)}…`);
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}): ${url}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
  }
}

async function cachedText(url, filename) {
  const file = path.join(cacheDir, filename);
  await downloadFile(url, file);
  return readFile(file, "utf8");
}

await downloadFile(ecdictUrl, ecdictPath);

async function loadExamExamples() {
  const examples = new Map();
  for (const [name, url] of examExampleArchives) {
    const file = path.join(cacheDir, `${name}.zip`);
    await downloadFile(url, file);
    const jsonLines = execFileSync("unzip", ["-p", file], { encoding: "utf8", maxBuffer: 24 * 1024 * 1024 });
    for (const line of jsonLines.split(/\r?\n/).filter(Boolean)) {
      const entry = JSON.parse(line);
      const word = String(entry.headWord ?? "").trim();
      if (!word || examples.has(word.toLowerCase())) continue;
      const content = entry.content?.word?.content ?? {};
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const sentences = content.sentence?.sentences?.map((sentence) => sentence.sContent).filter(Boolean) ?? [];
      const sentence = sentences.find((value) => new RegExp(`\\b${escapedWord}\\b`, "i").test(value));
      const exam = content.exam?.map((item) => item.question).find((value) => value?.includes("_"));
      const example = sentence || exam?.replace(/_+/g, word);
      if (example) examples.set(word.toLowerCase(), example);
    }
  }
  return examples;
}

const examExamples = await loadExamExamples();

const rowsByWord = new Map();
const rankedCandidates = new Map(books.filter((book) => book.mode === "ranked").map((book) => [book.id, []]));
const parser = Readable.fromWeb(new Blob([await readFile(ecdictPath)]).stream()).pipe(
  parse({ columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true }),
);

for await (const row of parser) {
  const word = String(row.word ?? "").trim();
  if (!word) continue;
  const normalized = {
    ...row,
    word,
    definition: String(row.definition ?? "").trim(),
    translation: String(row.translation ?? "").trim(),
  };
  rowsByWord.set(word.toLowerCase(), normalized);

  if (!/^[a-z][a-z'-]{2,20}$/i.test(word) || word.includes(" ") || stopWords.has(word.toLowerCase()) || !normalized.definition || !normalized.translation) continue;
  for (const book of books.filter((item) => item.mode === "ranked")) {
    if (book.matches(normalized)) rankedCandidates.get(book.id).push(normalized);
  }
}

const rank = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 999999;
};

function uniqueRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.word.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectRankedRows(book) {
  const rows = rankedCandidates.get(book.id);
  rows.sort((a, b) => Math.min(rank(a.bnc), rank(a.frq)) - Math.min(rank(b.bnc), rank(b.frq)) || a.word.localeCompare(b.word));
  return uniqueRows(rows).slice(0, book.count).map((row) => ({ row, answers: [], useApi: true }));
}

function selectTaggedRows(book) {
  return uniqueRows([...rowsByWord.values()].filter((row) =>
    String(row.tag ?? "").split(/\s+/).includes(book.tag) && row.definition && row.translation,
  )).map((row) => ({
    row,
    answers: [],
    useApi: false,
    example: examExamples.get(row.word.toLowerCase()),
    sourceName: examExamples.has(row.word.toLowerCase()) ? "ECDICT + Qwerty Learner examples" : "ECDICT",
  }));
}

async function selectBasicRows() {
  const overrides = {
    a: {
      definition: "used before a singular noun when the person or thing is not specified",
      example: "She adopted a cat from the local shelter.",
    },
    be: {
      definition: "to exist or to have a particular quality or state",
      example: "It is good to be curious and keep learning.",
    },
  };
  const text = await cachedText(basicEnglishUrl, "basic-english-850-words.txt");
  const entries = text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^(OPERATIONS|THINGS|QUALITIES)/.test(line))
    .map((line) => line.split("/").map((word) => word.trim().toLowerCase()).filter(Boolean));

  return entries.map(([word, ...answers]) => {
    const row = rowsByWord.get(word);
    if (!row?.definition || !row.translation) throw new Error(`Basic English entry is missing from ECDICT: ${word}`);
    return { row, answers, useApi: true, ...overrides[word] };
  });
}

async function selectComputerRows() {
  const files = ["itVocabulary.json", "it-words.json"];
  const seeds = new Map();
  for (const filename of files) {
    const content = await cachedText(`${qwertyBaseUrl}/${filename}`, `qwerty-${filename}`);
    for (const entry of JSON.parse(content)) {
      const word = String(entry.name ?? "").trim();
      const key = word.toLowerCase();
      if (!word || ["on-", "landler"].includes(key)) continue;
      const current = seeds.get(key);
      seeds.set(key, {
        word,
        translation: current?.translation || (entry.trans ?? []).join("\n"),
        phonetic: current?.phonetic || entry.usphone || entry.ukphone,
      });
    }
  }

  return [...seeds.values()].map((seed) => {
    const source = rowsByWord.get(seed.word.toLowerCase());
    const row = {
      ...(source ?? {}),
      word: seed.word,
      translation: source?.translation || seed.translation,
      definition: source?.definition || "A term used in computing and software development.",
      phonetic: source?.phonetic || seed.phonetic,
      pos: source?.pos || "n.",
    };
    if (!row.translation) throw new Error(`Computer entry has no Chinese translation: ${seed.word}`);
    return {
      row,
      answers: [],
      useApi: !source?.definition,
      sourceName: "ECDICT + Qwerty Learner word lists",
    };
  });
}

function lines(value, limit = 2) {
  return String(value ?? "")
    .split(/\\n|\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function fallbackExample(word, pos) {
  if (/\b(v|vt|vi)\b/i.test(pos)) return `We need to ${word} this before the next meeting.`;
  if (/\b(adj)\b/i.test(pos)) return `The team found the result surprisingly ${word}.`;
  if (/\b(adv)\b/i.test(pos)) return `The situation changed ${word} over time.`;
  return `The word ${word} came up during today's discussion.`;
}

const apiCachePath = path.join(cacheDir, "dictionary-api.json");
let apiCache = {};
try {
  apiCache = JSON.parse(await readFile(apiCachePath, "utf8"));
} catch {}

async function enrich(candidate) {
  const { row, answers, useApi, sourceName, definition: preferredDefinition, example: preferredExample } = candidate;
  const key = row.word.toLowerCase();
  const lookupKeys = [key, ...answers.map((answer) => answer.toLowerCase())];
  if (useApi) {
    for (const lookupKey of lookupKeys) {
      if (lookupKey in apiCache) continue;
      try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lookupKey)}`);
        apiCache[lookupKey] = response.ok ? await response.json() : null;
      } catch {
        apiCache[lookupKey] = null;
      }
    }
  }
  const apiEntries = useApi
    ? lookupKeys.map((lookupKey) => apiCache[lookupKey]).find((entries) => Array.isArray(entries)) ?? []
    : [];
  const definitions = apiEntries.flatMap((entry) => entry.meanings ?? []).flatMap((meaning) => meaning.definitions ?? []);
  const apiDefinition = definitions.find((item) => item.definition)?.definition;
  const escapedWord = row.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const apiExample = definitions.find((item) => item.example && new RegExp(`\\b${escapedWord}\\b`, "i").test(item.example))?.example;
  const phonetics = apiEntries.flatMap((entry) => entry.phonetics ?? []);
  const audio = phonetics.find((item) => item.audio)?.audio;
  const phonetic = phonetics.find((item) => item.text)?.text || row.phonetic;
  const usedApi = Boolean(apiDefinition || apiExample || audio);
  return {
    id: key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    word: row.word,
    answers,
    zh: lines(row.translation),
    en: [preferredDefinition || apiDefinition || lines(row.definition, 1)[0]],
    examples: [preferredExample || apiExample || fallbackExample(row.word, row.pos)],
    phonetic: phonetic || undefined,
    audio: audio ? (audio.startsWith("//") ? `https:${audio}` : audio) : undefined,
    source: {
      name: sourceName || (usedApi ? "ECDICT + Free Dictionary API" : "ECDICT"),
      url: "https://github.com/skywind3000/ECDICT",
      license: useApi ? "MIT; pronunciation audio may use CC licenses listed by Dictionary API" : "MIT",
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

async function selectRows(book) {
  if (book.mode === "ranked") return selectRankedRows(book);
  if (book.mode === "tag") return selectTaggedRows(book);
  if (book.mode === "basic") return selectBasicRows();
  if (book.mode === "computer") return selectComputerRows();
  throw new Error(`Unknown dictionary mode: ${book.mode}`);
}

const manifest = [];
for (const book of books) {
  const selected = await selectRows(book);
  if (selected.length !== book.count) throw new Error(`${book.id} expected ${book.count} entries but selected ${selected.length}`);
  console.log(`Building ${book.name}: ${selected.length} words…`);
  const words = await mapWithConcurrency(selected, 20, enrich);
  const publicBook = {
    id: book.id,
    name: book.name,
    description: book.description,
    count: book.count,
    accent: book.accent,
  };
  const payload = { ...publicBook, builtIn: true, words };
  await writeFile(path.join(outputDir, `${book.id}.json`), JSON.stringify(payload));
  manifest.push({ id: book.id, name: book.name, description: book.description, count: words.length, builtIn: true, accent: book.accent });
  await writeFile(apiCachePath, JSON.stringify(apiCache));
}

manifest.sort((a, b) => manifestOrder.indexOf(a.id) - manifestOrder.indexOf(b.id));
await writeFile(path.join(dataDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("Dictionary build complete.");
