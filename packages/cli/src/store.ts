import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { emptyLearnerState, type LearnerState } from "@chatwords/core";

export function chatWordsHome(): string {
  return process.env.CHATWORDS_HOME
    ? path.resolve(process.env.CHATWORDS_HOME)
    : path.join(os.homedir(), ".chatwords");
}

export function learnerStatePath(): string {
  return path.join(chatWordsHome(), "state.json");
}

export async function readLearnerState(): Promise<LearnerState> {
  try {
    const value = JSON.parse(await readFile(learnerStatePath(), "utf8")) as Partial<LearnerState>;
    if (value.version !== 1 || !Array.isArray(value.sessions) || !Array.isArray(value.progress)) {
      throw new Error("状态文件格式不受支持");
    }
    return value as LearnerState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyLearnerState();
    throw error;
  }
}

export async function writeLearnerState(state: LearnerState): Promise<void> {
  const directory = chatWordsHome();
  const target = learnerStatePath();
  const temporary = path.join(directory, `.state-${process.pid}-${Date.now()}.json`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
  await chmod(target, 0o600);
}
