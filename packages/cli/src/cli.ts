#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  activeSession,
  answerPractice,
  practicePrompt,
  skipPractice,
  startPractice,
  type LearnerState,
  type PracticePrompt,
  type WordBook,
} from "@chatwords/core";
import { loadBookManifest, loadBuiltInBook } from "@chatwords/core/catalog";
import { learnerStatePath, readLearnerState, writeLearnerState } from "./store.js";
import { progressBar, terminal } from "./terminal.js";

type CliOptions = {
  json: boolean;
  fresh: boolean;
  size: number | "all";
  positionals: string[];
};

function helpText(): string {
  return `${terminal.accent("chatWords")} ${terminal.dim("· 在终端里持续背单词")}

${terminal.bold("用法")}
  chatwords <命令> [参数]

${terminal.bold("命令")}
  ${terminal.accent("study")}    [词本ID]   开始或继续交互练习
  ${terminal.accent("books")}               查看内置词本
  ${terminal.accent("status")}              查看全局学习状态
  ${terminal.accent("start")}    [词本ID]   开始或恢复一轮练习
  ${terminal.accent("current")}             查看当前题目
  ${terminal.accent("answer")}   <答案>     提交答案
  ${terminal.accent("skip")}                跳过当前单词

${terminal.bold("常用选项")}
  ${terminal.accent("--size")} <数量|all>   设置本轮单词数，默认 20
  ${terminal.accent("--new")}               强制开始新一轮
  ${terminal.accent("--json")}              输出稳定的机器可读 JSON
  ${terminal.accent("--help")}              显示帮助

${terminal.bold("示例")}
  ${terminal.dim("$")} chatwords study workplace
  ${terminal.dim("$")} chatwords start cet4 --size 20 --json
  ${terminal.dim("$")} chatwords status

${terminal.bold("状态")}
  ${terminal.dim(learnerStatePath())}
  ${terminal.dim("可通过 CHATWORDS_HOME 使用独立状态目录")}`;
}

function parseOptions(args: string[]): CliOptions {
  const positionals: string[] = [];
  let json = false;
  let fresh = false;
  let size: number | "all" = 20;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--json") json = true;
    else if (value === "--new") fresh = true;
    else if (value === "--size") {
      const raw = args[index + 1];
      index += 1;
      if (raw === "all") size = "all";
      else {
        const parsed = Number(raw);
        if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("--size 必须是正整数或 all");
        size = parsed;
      }
    } else if (value.startsWith("-")) throw new Error(`未知参数：${value}`);
    else positionals.push(value);
  }
  return { json, fresh, size, positionals };
}

function output(value: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(value));
    return;
  }
  console.log(value);
}

function displayPhonetic(phonetic: string): string {
  return `/${phonetic.replace(/^\/+|\/+$/g, "")}/`;
}

function promptText(prompt: PracticePrompt): string {
  const lines = [
    `${terminal.accent(`● ${prompt.bookName}`)}  ${terminal.dim(`${prompt.position} / ${prompt.total}`)}`,
    "",
    `${terminal.bold("中文")}  ${prompt.zh.join("；")}`,
    `${terminal.bold("英文")}  ${prompt.en}`,
  ];
  if (prompt.phonetic) {
    lines.push(`${terminal.bold("音标")}  ${terminal.accent(displayPhonetic(prompt.phonetic))}`);
  }
  lines.push(`${terminal.bold("例句")}  ${prompt.example.replace(/_+/g, (blank) => terminal.accent(blank))}`);
  if (prompt.hint) lines.push("", `${terminal.yellow("提示")}  ${prompt.hint}`);
  return lines.join("\n");
}

function answerFeedback(correct: boolean, answer: string | undefined, message: string): string {
  return correct
    ? `${terminal.green("✓ 答对了")}  ${terminal.bold(answer ?? "")}`
    : `${terminal.yellow("! 再想一下")}  ${terminal.dim(message)}`;
}

function skippedFeedback(answer: string | undefined): string {
  return `${terminal.yellow("↷ 已跳过")}  ${terminal.bold(answer ?? "")}`;
}

function completedText(): string {
  return terminal.green("✓ 本轮练习完成");
}

function sessionSummary(state: LearnerState) {
  return state.sessions.map((session) => ({
    bookId: session.bookId,
    completed: session.index >= session.queue.length,
    position: Math.min(session.index + 1, session.queue.length),
    total: session.queue.length,
    correct: session.results.filter((result) => result.result === "correct").length,
    skipped: session.results.filter((result) => result.result === "skipped").length,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
  }));
}

async function resolveActiveBook(state: LearnerState, requested?: string): Promise<WordBook> {
  const bookId = requested ?? state.activeBookId;
  if (!bookId) throw new Error("还没有当前词本，请先运行 chatwords start <词本ID>");
  return loadBuiltInBook(bookId);
}

async function runBooks(options: CliOptions): Promise<void> {
  const [manifest, state] = await Promise.all([loadBookManifest(), readLearnerState()]);
  const books = manifest.map((book) => ({
    ...book,
    learned: state.progress.filter((row) => row.bookId === book.id && row.correct > 0).length,
  }));
  if (options.json) return output({ ok: true, action: "books", books }, true);
  const rows = books.map((book) => {
    const current = state.activeBookId === book.id ? terminal.accent("›") : " ";
    const learned = book.learned > 0
      ? terminal.green(`${book.learned}/${book.count}`)
      : terminal.dim(`0/${book.count}`);
    return `${current} ${terminal.accent(book.id.padEnd(18))} ${book.name}  ${learned}`;
  });
  output(`${terminal.bold("内置词本")}\n${terminal.dim("  ID                 词本 · 已学会")}\n\n${rows.join("\n")}`, false);
}

async function runStart(options: CliOptions): Promise<void> {
  const state = await readLearnerState();
  const book = await resolveActiveBook(state, options.positionals[0] ?? state.activeBookId ?? "workplace");
  const result = startPractice(state, book, options.size, options.fresh);
  await writeLearnerState(result.state);
  if (options.json) {
    return output({ ok: true, action: "start", resumed: result.resumed, prompt: result.prompt }, true);
  }
  const action = result.resumed ? "继续练习" : "开始练习";
  output(`${terminal.accent("→")} ${terminal.bold(action)}  ${book.name}\n${terminal.dim("进度会自动保存")}\n\n${result.prompt ? promptText(result.prompt) : completedText()}`, false);
}

async function runCurrent(options: CliOptions): Promise<void> {
  const state = await readLearnerState();
  const session = activeSession(state);
  if (!session) throw new Error("当前没有练习，请先运行 chatwords start");
  const book = await resolveActiveBook(state);
  const prompt = practicePrompt(book, session);
  if (!prompt) throw new Error("当前练习已完成，请运行 chatwords start --new");
  if (options.json) return output({ ok: true, action: "current", prompt }, true);
  output(promptText(prompt), false);
}

async function runAnswer(options: CliOptions): Promise<void> {
  const answer = options.positionals.join(" ").trim();
  if (!answer) throw new Error("请提供答案，例如 chatwords answer organize");
  const state = await readLearnerState();
  const book = await resolveActiveBook(state);
  const result = answerPractice(state, book, answer);
  await writeLearnerState(result.state);
  if (options.json) {
    return output({
      ok: true,
      action: "answer",
      correct: result.correct,
      answer: result.answer,
      message: result.message,
      completed: result.completed,
      prompt: result.prompt,
    }, true);
  }
  output(`${answerFeedback(result.correct, result.answer, result.message)}${result.prompt ? `\n\n${promptText(result.prompt)}` : `\n\n${completedText()}`}`, false);
}

async function runSkip(options: CliOptions): Promise<void> {
  const state = await readLearnerState();
  const book = await resolveActiveBook(state);
  const result = skipPractice(state, book);
  await writeLearnerState(result.state);
  if (options.json) {
    return output({
      ok: true,
      action: "skip",
      answer: result.answer,
      message: result.message,
      completed: result.completed,
      prompt: result.prompt,
    }, true);
  }
  output(`${skippedFeedback(result.answer)}${result.prompt ? `\n\n${promptText(result.prompt)}` : `\n\n${completedText()}`}`, false);
}

async function runStatus(options: CliOptions): Promise<void> {
  const state = await readLearnerState();
  const summaries = sessionSummary(state);
  const learned = state.progress.filter((row) => row.correct > 0).length;
  const payload = {
    ok: true,
    action: "status",
    stateFile: learnerStatePath(),
    activeBookId: state.activeBookId,
    learned,
    answered: state.progress.reduce((total, row) => total + row.correct + row.skipped, 0),
    wrongAttempts: state.progress.reduce((total, row) => total + row.wrong, 0),
    sessions: summaries,
  };
  if (options.json) return output(payload, true);
  const active = summaries.find((session) => session.bookId === state.activeBookId);
  const current = active
    ? `${terminal.accent(active.bookId)}  ${progressBar(active.position, active.total)}  ${active.position}/${active.total}${active.completed ? terminal.green("  已完成") : ""}`
    : terminal.dim("尚未开始");
  output([
    terminal.bold("学习概览"),
    "",
    `${terminal.bold("已学会")}      ${terminal.green(String(payload.learned))} 个词`,
    `${terminal.bold("已完成答题")}  ${payload.answered} 次`,
    `${terminal.bold("错误尝试")}    ${payload.wrongAttempts} 次`,
    "",
    `${terminal.bold("当前练习")}    ${current}`,
    "",
    terminal.dim(`状态文件  ${payload.stateFile}`),
  ].join("\n"), false);
}

async function runStudy(options: CliOptions): Promise<void> {
  if (options.json) throw new Error("study 是交互命令，不支持 --json");
  let state = await readLearnerState();
  const book = await resolveActiveBook(state, options.positionals[0] ?? state.activeBookId ?? "workplace");
  const started = startPractice(state, book, options.size, options.fresh);
  state = started.state;
  await writeLearnerState(state);

  const readline = createInterface({ input: stdin, output: stdout });
  try {
    console.log(`${terminal.accent("→")} ${terminal.bold(started.resumed ? "继续练习" : "开始练习")}  ${book.name}`);
    console.log(terminal.dim("每次作答后自动保存进度"));
    let prompt = started.prompt;
    while (prompt) {
      console.log(`\n${promptText(prompt)}`);
      const answer = (await readline.question(`\n${terminal.bold("你的答案")} ${terminal.dim("(s 跳过 · q 退出)")} ${terminal.accent("›")} `)).trim();
      if (answer === "q") {
        console.log(terminal.dim("已保存进度，下次会从这里继续。"));
        break;
      }
      if (!answer) continue;
      const result = answer === "s"
        ? skipPractice(state, book)
        : answerPractice(state, book, answer);
      state = result.state;
      await writeLearnerState(state);
      console.log(answer === "s"
        ? skippedFeedback(result.answer)
        : answerFeedback(result.correct, result.answer, result.message));
      prompt = result.prompt;
    }
    if (!prompt) console.log(`\n${completedText()}`);
  } finally {
    readline.close();
  }
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  while (rawArgs[0] === "--") rawArgs.shift();
  const [command = "help", ...args] = rawArgs;
  const options = parseOptions(args);
  if (command === "help" || command === "--help" || command === "-h") return output(helpText(), false);
  if (command === "books") return runBooks(options);
  if (command === "start") return runStart(options);
  if (command === "current") return runCurrent(options);
  if (command === "answer") return runAnswer(options);
  if (command === "skip") return runSkip(options);
  if (command === "status") return runStatus(options);
  if (command === "study") return runStudy(options);
  throw new Error(`未知命令：${command}\n\n${helpText()}`);
}

main().catch((error: unknown) => {
  const json = process.argv.includes("--json");
  const message = error instanceof Error ? error.message : String(error);
  if (json) console.log(JSON.stringify({ ok: false, error: message }));
  else console.error(`${terminal.red("✗ 错误")}  ${message}`);
  process.exitCode = 1;
});
