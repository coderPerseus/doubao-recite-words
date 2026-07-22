export type AppShortcutAction =
  | "skip"
  | "speak"
  | "new-session"
  | "library"
  | "history"
  | "import"
  | "sidebar"
  | "settings";

export const shortcutKeys = {
  skip: ["Alt", "Enter"],
  speak: ["Alt", "P"],
  newSession: ["Alt", "N"],
  library: ["Alt", "L"],
  history: ["Alt", "H"],
  import: ["Alt", "U"],
  sidebar: ["Alt", "B"],
  settings: ["Alt", ","],
} as const;

export const shortcutDefinitions = [
  { action: "聚焦答题输入框", keys: ["/"] },
  { action: "发送答案", keys: ["Enter"] },
  { action: "跳过当前单词", keys: shortcutKeys.skip },
  { action: "播放当前单词发音", keys: shortcutKeys.speak },
  { action: "开始新练习", keys: shortcutKeys.newSession },
  { action: "打开词本", keys: shortcutKeys.library },
  { action: "查看学习历史", keys: shortcutKeys.history },
  { action: "上传自定义词本", keys: shortcutKeys.import },
  { action: "显示或隐藏侧边栏", keys: shortcutKeys.sidebar },
  { action: "打开设置", keys: shortcutKeys.settings },
  { action: "关闭弹窗或侧边栏", keys: ["Escape"] },
] as const;

type ShortcutEvent = {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  code: string;
};

export function matchAppShortcut(event: ShortcutEvent): AppShortcutAction | null {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;

  switch (event.code) {
    case "Enter": return "skip";
    case "KeyP": return "speak";
    case "KeyN": return "new-session";
    case "KeyL": return "library";
    case "KeyH": return "history";
    case "KeyU": return "import";
    case "KeyB": return "sidebar";
    case "Comma": return "settings";
    default: return null;
  }
}
