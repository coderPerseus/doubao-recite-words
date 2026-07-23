import { stdout } from "node:process";

const colorEnabled = !("NO_COLOR" in process.env)
  && process.env.TERM !== "dumb"
  && (Boolean(stdout.isTTY) || (Boolean(process.env.FORCE_COLOR) && process.env.FORCE_COLOR !== "0"));

function paint(code: string, value: string): string {
  return colorEnabled ? `\u001B[${code}m${value}\u001B[0m` : value;
}

export const terminal = {
  bold: (value: string) => paint("1", value),
  dim: (value: string) => paint("2", value),
  accent: (value: string) => paint("1;36", value),
  green: (value: string) => paint("32", value),
  yellow: (value: string) => paint("33", value),
  red: (value: string) => paint("31", value),
};

export function progressBar(value: number, total: number, width = 12): string {
  const ratio = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  const filled = Math.round(ratio * width);
  return `${terminal.green("━".repeat(filled))}${terminal.dim("─".repeat(width - filled))}`;
}
