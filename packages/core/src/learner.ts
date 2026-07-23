import { createSession, hintFor, isCorrectAnswer, maskExample, recordProgress } from "./study.js";
import type {
  LearnerState,
  PracticePrompt,
  SessionResult,
  StudySession,
  WordBook,
  WordProgress,
} from "./types.js";

export type StartPracticeResult = {
  state: LearnerState;
  session: StudySession;
  prompt?: PracticePrompt;
  resumed: boolean;
};

export type AnswerPracticeResult = {
  state: LearnerState;
  correct: boolean;
  answer?: string;
  message: string;
  prompt?: PracticePrompt;
  completed: boolean;
};

export function emptyLearnerState(): LearnerState {
  return { version: 1, sessions: [], progress: [] };
}

export function activeSession(state: LearnerState): StudySession | undefined {
  if (!state.activeBookId) return undefined;
  return state.sessions.find((session) => session.bookId === state.activeBookId);
}

export function practicePrompt(book: WordBook, session: StudySession): PracticePrompt | undefined {
  const wordId = session.queue[session.index];
  const entry = book.words.find((word) => word.id === wordId);
  if (!entry) return undefined;
  return {
    bookId: book.id,
    bookName: book.name,
    zh: entry.zh,
    en: entry.en[0] ?? "",
    example: maskExample(entry.examples[0] ?? "", entry),
    phonetic: entry.phonetic,
    position: session.index + 1,
    total: session.queue.length,
    wrongAttempts: session.wrongAttempts,
    hint: session.wrongAttempts >= 2 ? hintFor(entry) : undefined,
  };
}

export function startPractice(
  state: LearnerState,
  book: WordBook,
  size: number | "all",
  fresh = false,
): StartPracticeResult {
  const existing = state.sessions.find((session) => session.bookId === book.id);
  const canResume = !fresh && existing && existing.index < existing.queue.length;
  const session = canResume
    ? existing
    : createSession(book.id, book.words.map((word) => word.id), size);
  const sessions = [session, ...state.sessions.filter((item) => item.bookId !== book.id)];
  const nextState = { ...state, activeBookId: book.id, sessions };
  return { state: nextState, session, prompt: practicePrompt(book, session), resumed: Boolean(canResume) };
}

function finishTurn(
  state: LearnerState,
  book: WordBook,
  session: StudySession,
  result: SessionResult["result"],
): AnswerPracticeResult {
  const wordId = session.queue[session.index];
  const entry = book.words.find((word) => word.id === wordId);
  if (!entry) throw new Error("当前练习中的单词已不在词本中");

  const item: SessionResult = { wordId, result, wrongAttempts: session.wrongAttempts };
  const nextIndex = session.index + 1;
  const nextSession: StudySession = {
    ...session,
    index: nextIndex,
    wrongAttempts: 0,
    results: [...session.results, item],
    completedAt: nextIndex >= session.queue.length ? new Date().toISOString() : undefined,
  };
  const currentProgress = state.progress.find((row) => row.bookId === book.id && row.wordId === wordId);
  const nextProgress = recordProgress(currentProgress, book.id, item);
  const progress = replaceProgress(state.progress, nextProgress);
  const sessions = [nextSession, ...state.sessions.filter((saved) => saved.bookId !== book.id)];
  const nextState = { ...state, activeBookId: book.id, sessions, progress };
  const completed = nextIndex >= nextSession.queue.length;
  return {
    state: nextState,
    correct: result === "correct",
    answer: entry.word,
    message: result === "correct" ? `答对了：${entry.word}` : `已跳过：${entry.word}`,
    prompt: completed ? undefined : practicePrompt(book, nextSession),
    completed,
  };
}

export function answerPractice(state: LearnerState, book: WordBook, answer: string): AnswerPracticeResult {
  const session = state.sessions.find((item) => item.bookId === book.id);
  if (!session || session.index >= session.queue.length) throw new Error("当前没有进行中的练习");
  const entry = book.words.find((word) => word.id === session.queue[session.index]);
  if (!entry) throw new Error("当前练习中的单词已不在词本中");
  if (isCorrectAnswer(answer, entry)) return finishTurn(state, book, session, "correct");

  const nextSession = { ...session, wrongAttempts: session.wrongAttempts + 1 };
  const sessions = [nextSession, ...state.sessions.filter((saved) => saved.bookId !== book.id)];
  const nextState = { ...state, activeBookId: book.id, sessions };
  return {
    state: nextState,
    correct: false,
    message: nextSession.wrongAttempts >= 2 ? `还差一点。${hintFor(entry)}` : "这个拼写不对，再想一下。",
    prompt: practicePrompt(book, nextSession),
    completed: false,
  };
}

export function skipPractice(state: LearnerState, book: WordBook): AnswerPracticeResult {
  const session = state.sessions.find((item) => item.bookId === book.id);
  if (!session || session.index >= session.queue.length) throw new Error("当前没有进行中的练习");
  return finishTurn(state, book, session, "skipped");
}

function replaceProgress(progress: WordProgress[], next: WordProgress): WordProgress[] {
  return [
    ...progress.filter((row) => !(row.bookId === next.bookId && row.wordId === next.wordId)),
    next,
  ];
}
