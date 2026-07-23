import { chmod, lstat, mkdir, readlink, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "packages", "cli", "dist", "cli.js");
const skill = path.join(root, "skills", "chatwords-learn");
const home = os.homedir();

async function ensureSymlink(source, target) {
  await mkdir(path.dirname(target), { recursive: true });
  try {
    const stat = await lstat(target);
    if (!stat.isSymbolicLink()) throw new Error(`${target} 已存在且不是符号链接，请先手动确认`);
    const existing = path.resolve(path.dirname(target), await readlink(target));
    if (existing !== source) throw new Error(`${target} 已指向其他位置，请先手动确认`);
    return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await symlink(source, target);
}

await chmod(cli, 0o755);
await ensureSymlink(cli, path.join(home, ".local", "bin", "chatwords"));
await ensureSymlink(skill, path.join(home, ".codex", "skills", "chatwords-learn"));
await ensureSymlink(skill, path.join(home, ".agents", "skills", "chatwords-learn"));

console.log("chatwords CLI 和 chatwords-learn Skill 已安装到全局。");
