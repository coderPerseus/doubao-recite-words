export type WordSource = {
  name: string;
  url?: string;
  license?: string;
};

export type WordEntry = {
  id: string;
  word: string;
  answers: string[];
  zh: string[];
  en: string[];
  examples: string[];
  phonetic?: string;
  audio?: string;
  source: WordSource;
};

export type WordBookSummary = {
  id: string;
  name: string;
  description: string;
  count: number;
  builtIn: boolean;
  accent: "sage" | "slate" | "sand" | "custom";
};

export type WordBook = WordBookSummary & {
  words: WordEntry[];
};

export type SessionResult = {
  wordId: string;
  result: "correct" | "skipped";
  wrongAttempts: number;
};

export type StudySession = {
  id: string;
  bookId: string;
  title?: string;
  queue: string[];
  index: number;
  results: SessionResult[];
  wrongAttempts: number;
  startedAt: string;
  completedAt?: string;
};

export type WordProgress = {
  bookId: string;
  wordId: string;
  correct: number;
  wrong: number;
  skipped: number;
  lastSeenAt: string;
};

export type UserSettings = {
  theme: "chatgpt" | "deepseek" | "vscode-dark-pro" | "vscode-light" | "solarized-light";
  autoPlay: boolean;
  speechRate: number;
  sessionSize: 10 | 20 | 50 | "all";
};
