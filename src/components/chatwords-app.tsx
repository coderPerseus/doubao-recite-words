"use client";

import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Ellipsis,
  FileUp,
  History,
  Keyboard,
  Menu,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  Share,
  SkipForward,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { parseWordBook, type ImportResult } from "@/lib/import-wordbook";
import { matchAppShortcut, shortcutDefinitions, shortcutKeys } from "@/lib/shortcuts";
import { createSession, hintFor, isCorrectAnswer, maskExample, recordProgress } from "@/lib/study";
import { storage } from "@/lib/storage";
import type { StudySession, UserSettings, WordBook, WordBookSummary, WordEntry, WordProgress } from "@/lib/types";

const defaultSettings: UserSettings = {
  theme: "chatgpt",
  autoPlay: true,
  speechRate: 0.9,
  sessionSize: 20,
};

const AUTO_PLAY_DEFAULT_VERSION = "1";

const themes: Array<{
  id: UserSettings["theme"];
  name: string;
  description: string;
  colors: [string, string, string];
}> = [
  { id: "chatgpt", name: "ChatGPT", description: "默认灰白", colors: ["#fcfcfc", "#f4f4f4", "#0d0d0d"] },
  { id: "deepseek", name: "DeepSeek", description: "清透蓝灰", colors: ["#f5f7fb", "#ffffff", "#4d6bfe"] },
  { id: "vscode-dark-pro", name: "VSCode Dark Pro", description: "编辑器深色", colors: ["#1e1e1e", "#252526", "#007acc"] },
  { id: "vscode-light", name: "VSCode Light", description: "编辑器浅色", colors: ["#ffffff", "#f3f3f3", "#0078d4"] },
  { id: "solarized-light", name: "Solarized Light", description: "暖色护眼", colors: ["#fdf6e3", "#eee8d5", "#268bd2"] },
];

const defaultConversationTitles: Record<string, string> = {
  workplace: "职场会议常用词",
  cet4: "昨天的错词复习",
  programmer: "程序员英语 · Chapter 1",
};

const fixedConversationOrder = ["cet4", "programmer", "workplace"];

function displayShortcutKeys(keys: readonly string[], isMac: boolean) {
  return keys.map((key) => {
    if (key === "Alt") return isMac ? "⌥" : "Alt";
    if (key === "Enter") return "Enter";
    if (key === "Escape") return "Esc";
    return key;
  });
}

function shortcutTitle(keys: readonly string[], isMac: boolean) {
  return displayShortcutKeys(keys, isMac).join(isMac ? "" : " + ");
}

function subscribeToPlatform() {
  return () => undefined;
}

function getIsMacSnapshot() {
  return /Macintosh|Mac OS|iPhone|iPad/.test(navigator.userAgent);
}

function normalizeTheme(theme: unknown): UserSettings["theme"] {
  if (theme === "dark") return "vscode-dark-pro";
  if (theme === "light" || theme === "system") return "chatgpt";
  return themes.some((item) => item.id === theme) ? theme as UserSettings["theme"] : "chatgpt";
}

type ModalName = "library" | "settings" | "history" | "import" | null;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function progressPercent(book: WordBookSummary, progress: WordProgress[]) {
  const learned = progress.filter((item) => item.bookId === book.id && item.correct > 0).length;
  return Math.min(100, Math.round((learned / Math.max(book.count, 1)) * 100));
}

function conversationTitle(session: StudySession | undefined, book: WordBookSummary, titles: Record<string, string>) {
  return titles[book.id]?.trim() || session?.title?.trim() || defaultConversationTitles[book.id] || book.name;
}

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function youdaoPronunciationUrl(word: string) {
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`;
}

function displayPhonetic(phonetic?: string) {
  if (!phonetic) return "发音";
  return `/${phonetic.replace(/^\/+|\/+$/g, "")}/`;
}

function AssistantMark() {
  return <div className="assistant-mark" aria-hidden="true">cw</div>;
}

function ResponseActions({ entry, onSpeak, revealed = false, showSpeak = true }: { entry: WordEntry; onSpeak: () => void; revealed?: boolean; showSpeak?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  async function copyResponse() {
    const lines = [
      `中文释义：${entry.zh.join("；")}`,
      `英文解释：${entry.en[0]}`,
      `例句：${maskExample(entry.examples[0], entry)}`,
      revealed ? `答案：${entry.word}` : "",
    ].filter(Boolean);
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="response-actions" aria-label="回复操作">
      <button onClick={copyResponse} type="button" aria-label={copied ? "已复制" : "复制回复"} title={copied ? "已复制" : "复制"}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      {showSpeak && <button onClick={onSpeak} type="button" aria-label={`播放 ${entry.word} 的发音`} title="播放发音"><Volume2 size={17} /></button>}
      <button className={feedback === "up" ? "active" : undefined} onClick={() => setFeedback(feedback === "up" ? null : "up")} type="button" aria-label="有帮助" title="有帮助"><ThumbsUp size={16} /></button>
      <button className={feedback === "down" ? "active" : undefined} onClick={() => setFeedback(feedback === "down" ? null : "down")} type="button" aria-label="没有帮助" title="没有帮助"><ThumbsDown size={16} /></button>
    </div>
  );
}

function Clue({ entry, showHint, onSpeak }: { entry: WordEntry; showHint: boolean; onSpeak: () => void }) {
  return (
    <div className="assistant-row reveal-message">
      <AssistantMark />
      <div className="assistant-copy">
        <p className="clue-lead">请猜出下面描述对应的英文单词：</p>
        <ul className="clue-list">
          <li><strong>中文释义：</strong>{entry.zh.join("；")}</li>
          <li><strong>英文解释：</strong>{entry.en[0]}</li>
        </ul>
        <blockquote>{maskExample(entry.examples[0], entry)}</blockquote>
        <div className="clue-tools">
          <button className="pronunciation-action" onClick={onSpeak} type="button" aria-label={`播放 ${entry.word} 的发音`} title="播放发音">
            <Volume2 size={17} />
            <span>{displayPhonetic(entry.phonetic)}</span>
          </button>
          {showHint && <span className="hint-chip">提示：{hintFor(entry)}</span>}
          <ResponseActions entry={entry} onSpeak={onSpeak} showSpeak={false} />
        </div>
      </div>
    </div>
  );
}

function PastTurn({ entry, result, onSpeak }: { entry: WordEntry; result: StudySession["results"][number]; onSpeak: () => void }) {
  return (
    <>
      <Clue entry={entry} showHint={result.wrongAttempts >= 2} onSpeak={onSpeak} />
      <div className="user-row reveal-message"><div className="user-bubble">{result.result === "skipped" ? "跳过这题" : entry.word}</div></div>
      <div className="assistant-row result-row reveal-message">
        <AssistantMark />
        <div className="assistant-copy">
          {result.result === "correct" ? (
            <p><span className="success-icon"><Check size={14} /></span>答对了。这个词是 <strong>{entry.word}</strong>。</p>
          ) : (
            <p>没关系，这个词是 <strong>{entry.word}</strong>。我已经把它记进待复习列表。</p>
          )}
          <ResponseActions entry={entry} onSpeak={onSpeak} revealed />
        </div>
      </div>
    </>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button onClick={onClose} aria-label="关闭"><X size={19} /></button></header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

export default function ChatWordsApp() {
  const [books, setBooks] = useState<WordBookSummary[]>([]);
  const [customBooks, setCustomBooks] = useState<WordBook[]>([]);
  const [activeBook, setActiveBook] = useState<WordBook | null>(null);
  const [session, setSession] = useState<StudySession | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [progress, setProgress] = useState<WordProgress[]>([]);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [answer, setAnswer] = useState("");
  const [answerError, setAnswerError] = useState("");
  const [modal, setModal] = useState<ModalName>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [bookQuery, setBookQuery] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [toast, setToast] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [conversationDraft, setConversationDraft] = useState("");
  const [conversationTitles, setConversationTitles] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pronunciationRef = useRef<HTMLAudioElement | null>(null);
  const announcedTurnRef = useRef<string | null>(null);

  const allBooks = useMemo(() => [...books, ...customBooks.map((book) => ({
    id: book.id,
    name: book.name,
    description: book.description,
    count: book.count,
    builtIn: book.builtIn,
    accent: book.accent,
  }))], [books, customBooks]);
  const wordMap = useMemo(() => new Map(activeBook?.words.map((word) => [word.id, word]) ?? []), [activeBook]);
  const currentEntry = session && session.index < session.queue.length ? wordMap.get(session.queue[session.index]) : undefined;
  const finished = Boolean(session && session.index >= session.queue.length);
  const isMac = useSyncExternalStore(subscribeToPlatform, getIsMacSnapshot, () => false);
  const recentConversations = useMemo(() => {
    const latestByBook = new Map<string, StudySession>();
    [...sessions]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .forEach((savedSession) => {
        if (!latestByBook.has(savedSession.bookId)) latestByBook.set(savedSession.bookId, savedSession);
      });
    return allBooks
      .map((book) => ({ book, session: latestByBook.get(book.id) }))
      .sort((a, b) => {
        const aIndex = fixedConversationOrder.indexOf(a.book.id);
        const bIndex = fixedConversationOrder.indexOf(b.book.id);
        return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
      })
      .slice(0, 12);
  }, [allBooks, sessions]);

  const getBook = useCallback(async (summary: WordBookSummary, customs = customBooks): Promise<WordBook> => {
    if (!summary.builtIn) {
      const custom = customs.find((book) => book.id === summary.id);
      if (!custom) throw new Error("找不到这个自定义词本");
      return custom;
    }
    const response = await fetch(`/data/books/${summary.id}.json`, { cache: "no-store" });
    if (!response.ok) throw new Error("词本加载失败");
    return response.json() as Promise<WordBook>;
  }, [customBooks]);

  const openBook = useCallback(async (summary: WordBookSummary, fresh = false, customs = customBooks, nextSettings = settings) => {
    setLoading(true);
    setAnswer("");
    setAnswerError("");
    try {
      const book = await getBook(summary, customs);
      const existing = await storage.latestSession(book.id);
      const created = createSession(book.id, book.words.map((word) => word.id), nextSettings.sessionSize);
      const nextSession = fresh || !existing
        ? { ...created, id: existing?.id ?? created.id, title: existing?.title }
        : existing;
      if (fresh || !existing) await storage.replaceBookSession(nextSession);
      setSessions((rows) => [nextSession, ...rows.filter((row) => row.bookId !== book.id)]);
      setActiveBook(book);
      setSession(nextSession);
      localStorage.setItem("chatwords:book", book.id);
      setSidebarOpen(false);
    } finally {
      setLoading(false);
    }
  }, [customBooks, getBook, settings]);

  const openSession = useCallback(async (savedSession: StudySession, summary: WordBookSummary) => {
    setLoading(true);
    setAnswer("");
    setAnswerError("");
    try {
      const book = await getBook(summary);
      setActiveBook(book);
      setSession(savedSession);
      localStorage.setItem("chatwords:book", book.id);
      setSidebarOpen(false);
    } catch {
      setToast("这条练习使用的词本已经不存在。");
    } finally {
      setLoading(false);
    }
  }, [getBook]);

  const renameConversation = useCallback(async (book: WordBookSummary, savedSession?: StudySession) => {
    const title = conversationDraft.trim();
    if (!title) return;
    const nextTitles = { ...conversationTitles, [book.id]: title };
    setConversationTitles(nextTitles);
    localStorage.setItem("chatwords:conversation-titles", JSON.stringify(nextTitles));
    if (savedSession) {
      const renamedSession = { ...savedSession, title };
      setSessions((rows) => [renamedSession, ...rows.filter((row) => row.bookId !== renamedSession.bookId)]);
      if (session?.id === renamedSession.id) setSession(renamedSession);
      await storage.saveSession(renamedSession);
    }
    setEditingSessionId(null);
    setConversationDraft("");
    setToast(`已重命名为“${title}”`);
  }, [conversationDraft, conversationTitles, session?.id]);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      const storedSettings = JSON.parse(localStorage.getItem("chatwords:settings") || "null") as UserSettings | null;
      const hasCurrentAutoPlayDefault = localStorage.getItem("chatwords:auto-play-default-version") === AUTO_PLAY_DEFAULT_VERSION;
      const storedConversationTitles = JSON.parse(localStorage.getItem("chatwords:conversation-titles") || "{}") as Record<string, string>;
      const initialSettings = storedSettings
        ? { ...defaultSettings, ...storedSettings, theme: normalizeTheme(storedSettings.theme) }
        : defaultSettings;
      if (!hasCurrentAutoPlayDefault) {
        initialSettings.autoPlay = true;
        localStorage.setItem("chatwords:auto-play-default-version", AUTO_PLAY_DEFAULT_VERSION);
      }
      const [manifestResponse, savedBooks, savedProgress, savedSessions] = await Promise.all([
        fetch("/data/manifest.json", { cache: "no-store" }), storage.getBooks(), storage.getProgress(), storage.getSessions(),
      ]);
      const manifest = await manifestResponse.json() as WordBookSummary[];
      if (cancelled) return;
      setSettings(initialSettings);
      setBooks(manifest);
      setCustomBooks(savedBooks);
      setProgress(savedProgress);
      setSessions(savedSessions);
      setConversationTitles(storedConversationTitles);
      const selectedId = localStorage.getItem("chatwords:book");
      const selected = [...manifest, ...savedBooks].find((book) => book.id === selectedId) ?? manifest[0];
      if (selected) await openBook(selected, false, savedBooks, initialSettings);
    }
    initialize().catch(() => {
      setToast("初始化失败，请刷新页面重试。");
      setLoading(false);
    });
    return () => { cancelled = true; };
    // Initialization intentionally runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    localStorage.setItem("chatwords:settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    if (!isTyping) inputRef.current?.focus();
  }, [session?.index, isTyping]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const speak = useCallback((entry: WordEntry) => {
    pronunciationRef.current?.pause();
    const synthesis = window.speechSynthesis;
    synthesis?.cancel();

    const playSystemVoice = () => {
      const Utterance = window.SpeechSynthesisUtterance;
      if (!synthesis || !Utterance) return;
      synthesis.cancel();
      const utterance = new Utterance(entry.word);
      utterance.lang = "en-US";
      utterance.rate = settings.speechRate;
      const voices = synthesis.getVoices();
      utterance.voice = voices.find((voice) =>
        ["Samantha", "Ava", "Google US English", "Microsoft Aria Online"].some((name) => voice.name.includes(name)),
      ) ?? voices.find((voice) => voice.lang.toLocaleLowerCase().startsWith("en-us")) ?? null;
      synthesis.speak(utterance);
    };

    const sources = [youdaoPronunciationUrl(entry.word), entry.audio].filter((source): source is string => Boolean(source));
    const playSource = (index: number) => {
      if (index >= sources.length) return playSystemVoice();
      const audio = new Audio(sources[index]);
      pronunciationRef.current = audio;
      audio.preload = "auto";
      audio.playbackRate = settings.speechRate;
      let advanced = false;
      const playNext = () => {
        if (advanced) return;
        advanced = true;
        playSource(index + 1);
      };
      audio.onerror = playNext;
      audio.play().catch(playNext);
    };
    playSource(0);
  }, [settings.speechRate]);

  useEffect(() => {
    if (!session || !currentEntry || isTyping) return;
    const turnKey = `${session.id}:${session.index}:${currentEntry.id}`;
    if (announcedTurnRef.current === turnKey) return;
    announcedTurnRef.current = turnKey;
    if (settings.autoPlay) speak(currentEntry);
  }, [currentEntry, isTyping, session, settings.autoPlay, speak]);

  useEffect(() => {
    if (!currentEntry) return;
    const audio = new Audio(youdaoPronunciationUrl(currentEntry.word));
    audio.preload = "auto";
    return () => {
      audio.src = "";
    };
  }, [currentEntry]);

  const finishTurn = useCallback(async (result: "correct" | "skipped") => {
    if (!session || !activeBook || !currentEntry) return;
    const item = { wordId: currentEntry.id, result, wrongAttempts: session.wrongAttempts } as const;
    const nextIndex = session.index + 1;
    const nextSession: StudySession = {
      ...session,
      index: nextIndex,
      wrongAttempts: 0,
      results: [...session.results, item],
      completedAt: nextIndex >= session.queue.length ? new Date().toISOString() : undefined,
    };
    const currentProgress = progress.find((row) => row.bookId === activeBook.id && row.wordId === currentEntry.id);
    const nextProgress = recordProgress(currentProgress, activeBook.id, item);
    setProgress((rows) => [...rows.filter((row) => !(row.bookId === nextProgress.bookId && row.wordId === nextProgress.wordId)), nextProgress]);
    setSession(nextSession);
    setSessions((rows) => [nextSession, ...rows.filter((row) => row.bookId !== nextSession.bookId)]);
    setAnswer("");
    setAnswerError("");
    setIsTyping(true);
    const nextEntry = wordMap.get(session.queue[nextIndex]);
    if (nextEntry) {
      announcedTurnRef.current = `${session.id}:${nextIndex}:${nextEntry.id}`;
      if (settings.autoPlay) speak(nextEntry);
    }
    await Promise.all([storage.saveSession(nextSession), storage.saveProgress(nextProgress)]);
    window.setTimeout(() => setIsTyping(false), 420);
  }, [activeBook, currentEntry, progress, session, settings.autoPlay, speak, wordMap]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.repeat) return;

      const target = event.target as HTMLElement | null;
      const editing = Boolean(target?.matches("input, textarea, select") || target?.isContentEditable);

      if (event.key === "Escape") {
        if (modal) {
          event.preventDefault();
          setModal(null);
        } else if (sidebarOpen) {
          event.preventDefault();
          setSidebarOpen(false);
        }
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === "/" && !editing && !modal && !finished) {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }

      const action = matchAppShortcut(event);
      if (!action) return;
      event.preventDefault();

      if (action === "new-session" && activeBook) {
        setModal(null);
        void openBook(activeBook, true);
      } else if (action === "library") {
        setModal("library");
      } else if (action === "history") {
        setModal("history");
      } else if (action === "import") {
        setModal("import");
      } else if (action === "sidebar") {
        if (window.matchMedia("(max-width: 767px)").matches) setSidebarOpen((open) => !open);
        else setSidebarCollapsed((collapsed) => !collapsed);
      } else if (action === "speak" && currentEntry) {
        speak(currentEntry);
      } else if (action === "skip" && currentEntry && !isTyping && !modal) {
        void finishTurn("skipped");
      } else if (action === "settings") {
        setModal("settings");
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activeBook, currentEntry, finishTurn, finished, isTyping, modal, openBook, sidebarOpen, speak]);

  async function submitAnswer(event: FormEvent) {
    event.preventDefault();
    if (!answer.trim() || !currentEntry || !session || isTyping) return;
    if (isCorrectAnswer(answer, currentEntry)) {
      await finishTurn("correct");
      return;
    }
    const nextSession = { ...session, wrongAttempts: session.wrongAttempts + 1 };
    setSession(nextSession);
    setSessions((rows) => [nextSession, ...rows.filter((row) => row.bookId !== nextSession.bookId)]);
    setAnswerError(nextSession.wrongAttempts >= 2 ? `还差一点。${hintFor(currentEntry)}` : "这个拼写不对，再想一下。");
    await storage.saveSession(nextSession);
  }

  async function handleImport(file: File) {
    const result = parseWordBook(await file.text(), file.name);
    setImportResult(result);
  }

  async function saveImportedBook() {
    if (!importResult?.book) return;
    await storage.saveBook(importResult.book);
    const nextBooks = [...customBooks.filter((book) => book.id !== importResult.book?.id), importResult.book];
    setCustomBooks(nextBooks);
    setImportResult(null);
    setModal(null);
    await openBook(importResult.book, true, nextBooks);
    setToast("词本已保存在这台设备上");
  }

  async function removeCustomBook(book: WordBookSummary) {
    await storage.deleteBook(book.id);
    setCustomBooks((items) => items.filter((item) => item.id !== book.id));
    if (activeBook?.id === book.id && books[0]) await openBook(books[0], false);
  }

  const filteredBooks = allBooks.filter((book) => `${book.name}${book.description}`.toLowerCase().includes(bookQuery.toLowerCase()));
  const correctCount = session?.results.filter((item) => item.result === "correct").length ?? 0;
  const skippedCount = session?.results.filter((item) => item.result === "skipped").length ?? 0;
  const accuracy = session?.results.length ? Math.round((correctCount / session.results.length) * 100) : 0;
  const sessionPosition = !loading && session
    ? Math.min(session.index + (finished ? 0 : 1), session.queue.length)
    : 0;
  const sessionProgress = session?.queue.length ? (sessionPosition / session.queue.length) * 100 : 0;
  const isDeepSeekTheme = settings.theme === "deepseek";

  return (
    <div className={cn("app-shell", sidebarCollapsed && "sidebar-collapsed")}>
      <aside className={cn("sidebar", sidebarOpen && "sidebar-mobile-open")}>
        <div className="sidebar-top">
          <button className="brand" onClick={() => activeBook && openBook(activeBook, true)} aria-label="chatWords 新练习" title={`开始新练习（${shortcutTitle(shortcutKeys.newSession, isMac)}）`}><span className="brand-mark" aria-hidden="true">cw</span><span>chatWords</span></button>
          <div className="sidebar-top-actions">
            <button aria-label="搜索词本" title={`打开词本（${shortcutTitle(shortcutKeys.library, isMac)}）`} onClick={() => setModal("library")}><Search size={18} /></button>
            <button aria-label="收起侧边栏" title={`收起侧边栏（${shortcutTitle(shortcutKeys.sidebar, isMac)}）`} onClick={() => setSidebarCollapsed(true)}><PanelLeftClose size={18} /></button>
          </div>
        </div>
        <nav className="primary-nav" aria-label="主导航">
          <button title={`开始新练习（${shortcutTitle(shortcutKeys.newSession, isMac)}）`} onClick={() => activeBook && openBook(activeBook, true)}><MessageSquarePlus size={17} />{isDeepSeekTheme ? "开启新对话" : "New chat"}</button>
          <button title={`打开词本（${shortcutTitle(shortcutKeys.library, isMac)}）`} onClick={() => setModal("library")}><BookOpen size={17} />Library</button>
          <button title={`学习历史（${shortcutTitle(shortcutKeys.history, isMac)}）`} onClick={() => setModal("history")}><History size={17} />History</button>
          <button title={`上传词本（${shortcutTitle(shortcutKeys.import, isMac)}）`} onClick={() => setModal("import")}><FileUp size={17} />Upload word book</button>
        </nav>
        <div className="sidebar-scroll">
          <div className="sidebar-label">{isDeepSeekTheme ? "学习词本" : "Word books"}</div>
          {allBooks.map((book) => {
            const percent = progressPercent(book, progress);
            return (
              <button key={book.id} className={cn("book-nav-item", activeBook?.id === book.id && "active")} onClick={() => openBook(book)}>
                <span className={cn("book-dot", book.accent)} />
                <span className="book-nav-copy"><span>{book.name}</span><small>{percent}% · {book.count} words</small></span>
                {activeBook?.id === book.id && <Ellipsis size={16} />}
              </button>
            );
          })}
          <div className="sidebar-label chats-label">{isDeepSeekTheme ? "最近练习" : "Chats"}</div>
          {recentConversations.map((item) => {
            const title = conversationTitle(item.session, item.book, conversationTitles);
            const conversationId = item.session?.id ?? `book:${item.book.id}`;
            const editing = editingSessionId === conversationId;
            return (
              <div className="history-row" key={conversationId}>
                {editing ? (
                  <form className="history-rename-form" onSubmit={(event) => { event.preventDefault(); void renameConversation(item.book, item.session); }}>
                    <input
                      autoFocus
                      value={conversationDraft}
                      onChange={(event) => setConversationDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setEditingSessionId(null);
                          setConversationDraft("");
                        }
                      }}
                      maxLength={40}
                      aria-label="修改对话名称"
                    />
                    <button type="submit" disabled={!conversationDraft.trim()} aria-label="保存对话名称"><Check size={14} /></button>
                  </form>
                ) : (
                  <>
                    <button
                      className={cn("history-item", activeBook?.id === item.book.id && "active")}
                      onClick={() => item.session ? openSession(item.session, item.book) : openBook(item.book)}
                      title={item.session ? `${title} · ${item.session.index}/${item.session.queue.length}` : `${title} · 尚未开始`}
                    >
                      {title}
                    </button>
                    <button
                      className="rename-chat-button"
                      type="button"
                      aria-label={`重命名 ${title}`}
                      title="重命名对话"
                      onClick={() => { setEditingSessionId(conversationId); setConversationDraft(title); }}
                    ><Pencil size={14} /></button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <button className="profile-button" title={`设置（${shortcutTitle(shortcutKeys.settings, isMac)}）`} onClick={() => setModal("settings")}>
          <span className="profile-avatar">cw</span><span><strong>Local learner</strong><small>数据仅保存在本机</small></span><Settings size={16} />
        </button>
      </aside>

      {sidebarOpen && <button className="mobile-scrim" onClick={() => setSidebarOpen(false)} aria-label="关闭侧边栏" />}

      <main className="chat-main">
        <header className="chat-header">
          <div className="header-left">
            <button className="mobile-menu" title={`打开侧边栏（${shortcutTitle(shortcutKeys.sidebar, isMac)}）`} onClick={() => setSidebarOpen(true)} aria-label="打开侧边栏"><Menu size={20} /></button>
            {sidebarCollapsed && <button className="desktop-open-sidebar" title={`打开侧边栏（${shortcutTitle(shortcutKeys.sidebar, isMac)}）`} onClick={() => setSidebarCollapsed(false)} aria-label="打开侧边栏"><PanelLeftOpen size={19} /></button>}
            <button className="model-button">
              <span className="model-copy"><span className="model-brand-name">chatWords</span><span className="model-book-name">{activeBook?.name ?? "单词练习"}</span><small>单词学习</small></span>
              <ChevronDown size={15} />
            </button>
          </div>
          <div className="header-actions">
            <button onClick={async () => { await navigator.clipboard.writeText(location.href); setToast("链接已复制"); }}><Share size={17} /> <span>Share</span></button>
            <button aria-label="打开设置" title={`设置（${shortcutTitle(shortcutKeys.settings, isMac)}）`} onClick={() => setModal("settings")}><Ellipsis size={19} /></button>
          </div>
        </header>

        <div className="conversation" ref={scrollRef}>
          <div className="conversation-column">
            <div className="assistant-row intro-message">
              <AssistantMark />
              <div className="assistant-copy">
                <p>我们来练习 <strong>{activeBook?.name ?? "单词"}</strong>。我会给你中文释义、英文解释和一个挖空例句，你只需要在下面输入对应的英文单词。</p>
                <p>当前练习 {session?.queue.length ?? settings.sessionSize} 个词，拼写正确后自动进入下一个。</p>
              </div>
            </div>

            {loading ? (
              <div className="assistant-row"><AssistantMark /><div className="typing-dots"><i /><i /><i /></div></div>
            ) : (
              <>
                {session?.results.map((result, index) => {
                  const entry = wordMap.get(session.queue[index]);
                  return entry ? <PastTurn key={`${session.id}-${entry.id}-${index}`} entry={entry} result={result} onSpeak={() => speak(entry)} /> : null;
                })}
                {isTyping && <div className="assistant-row"><AssistantMark /><div className="typing-dots"><i /><i /><i /></div></div>}
                {!finished && currentEntry && !isTyping && <Clue entry={currentEntry} showHint={(session?.wrongAttempts ?? 0) >= 2} onSpeak={() => speak(currentEntry)} />}
                {finished && session && (
                  <div className="assistant-row completion-message reveal-message">
                    <AssistantMark />
                    <div className="assistant-copy">
                      <h2>这轮练习完成了。</h2>
                      <p>共练习 {session.queue.length} 个词，答对 {correctCount} 个，跳过 {skippedCount} 个，正确率 {accuracy}%。</p>
                      <button className="dark-action" onClick={() => activeBook && openBook(activeBook, true)}>开始新一轮</button>
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="scroll-spacer" />
          </div>
        </div>

        <div className="composer-zone">
          <div className="composer-column">
            <div className="composer-skip-row">
              <button className="skip-button" type="button" title={`跳过当前单词（${shortcutTitle(shortcutKeys.skip, isMac)}）`} disabled={!currentEntry || isTyping} onClick={() => finishTurn("skipped")}><SkipForward size={16} /><span>{isDeepSeekTheme ? "跳过此词" : "Skip"}</span></button>
            </div>
            {answerError && <div className="answer-error" role="status">{answerError}</div>}
            <form className={cn("composer", answerError && "composer-error")} onSubmit={submitAnswer}>
              <button className="composer-plus" type="button" title={`选择词本（${shortcutTitle(shortcutKeys.library, isMac)}）`} onClick={() => setModal("library")} aria-label="选择词本"><Plus size={21} /><span className="composer-plus-label">词本</span></button>
              <textarea
                ref={inputRef}
                value={answer}
                onChange={(event) => { setAnswer(event.target.value); setAnswerError(""); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                disabled={finished || loading || isTyping}
                placeholder={finished ? "这轮练习已完成" : isDeepSeekTheme ? "给 chatWords 发送消息" : "Message chatWords"}
                aria-label="输入你猜到的单词"
                title="按 / 聚焦，按 Enter 发送"
              />
              <button className="send-button" type="submit" title="发送答案（Enter）" disabled={!answer.trim() || finished || isTyping} aria-label="发送答案"><SendHorizontal size={18} /></button>
            </form>
            <p className="disclaimer">{isDeepSeekTheme ? "内容由词典整理，请仔细甄别" : "chatWords can make mistakes. Check important definitions."}</p>
          </div>
        </div>
      </main>

      <div
        className="session-progress"
        role="progressbar"
        aria-label="当前练习进度"
        aria-valuemin={0}
        aria-valuemax={session?.queue.length ?? 0}
        aria-valuenow={sessionPosition}
        aria-valuetext={session?.queue.length ? `第 ${sessionPosition} 个，共 ${session.queue.length} 个单词` : "尚未开始练习"}
        title={session?.queue.length ? `${sessionPosition} / ${session.queue.length}` : undefined}
      >
        <span style={{ width: `${sessionProgress}%` }} />
      </div>

      {modal === "library" && (
        <ModalShell title="Library" onClose={() => setModal(null)}>
          <div className="search-field"><Search size={17} /><input value={bookQuery} onChange={(event) => setBookQuery(event.target.value)} placeholder="搜索词本" /></div>
          <div className="library-list">
            {filteredBooks.map((book) => (
              <div className="library-row" key={book.id}>
                <button className="library-main" onClick={() => { setModal(null); openBook(book); }}>
                  <span className={cn("library-icon", book.accent)}><BookOpen size={19} /></span>
                  <span><strong>{book.name}</strong><small>{book.description} · {book.count} 词</small></span>
                  <span className="library-progress">{progressPercent(book, progress)}%</span>
                </button>
                {!book.builtIn && <button className="delete-book" onClick={() => removeCustomBook(book)} aria-label={`删除 ${book.name}`}><Trash2 size={17} /></button>}
              </div>
            ))}
          </div>
          <button className="outline-action" onClick={() => setModal("import")}><FileUp size={17} />上传自定义词本</button>
        </ModalShell>
      )}

      {modal === "settings" && (
        <ModalShell title="Settings" onClose={() => setModal(null)}>
          <div className="theme-setting">
            <div className="setting-heading"><strong>主题</strong><small>选择一个适合办公环境的外观</small></div>
            <div className="theme-grid">
              {themes.map((theme) => (
                <button
                  className={cn("theme-card", settings.theme === theme.id && "active")}
                  key={theme.id}
                  type="button"
                  aria-pressed={settings.theme === theme.id}
                  onClick={() => setSettings({ ...settings, theme: theme.id })}
                >
                  <span className="theme-card-top">
                    <span className="theme-swatches" aria-hidden="true">
                      {theme.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}
                    </span>
                    {settings.theme === theme.id && <Check size={15} />}
                  </span>
                  <span className="theme-card-copy"><strong>{theme.name}</strong><small>{theme.description}</small></span>
                </button>
              ))}
            </div>
          </div>
          <div className="settings-list">
            <label><span><strong>每组词数</strong><small>新练习会使用这个数量</small></span><select value={settings.sessionSize} onChange={(event) => setSettings({ ...settings, sessionSize: event.target.value === "all" ? "all" : Number(event.target.value) as 10 | 20 | 50 })}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="all">全部</option></select></label>
            <label><span><strong>新单词出现时自动播放发音</strong><small>默认开启，音频不可用时使用浏览器朗读</small></span><input type="checkbox" checked={settings.autoPlay} onChange={(event) => setSettings({ ...settings, autoPlay: event.target.checked })} /></label>
            <label><span><strong>发音速度</strong><small>{settings.speechRate.toFixed(1)}×</small></span><input type="range" min="0.6" max="1.2" step="0.1" value={settings.speechRate} onChange={(event) => setSettings({ ...settings, speechRate: Number(event.target.value) })} /></label>
          </div>
          <section className="shortcut-settings" aria-labelledby="shortcut-settings-title">
            <div className="shortcut-heading">
              <span className="shortcut-heading-icon"><Keyboard size={17} /></span>
              <span><strong id="shortcut-settings-title">快捷键</strong><small>在页面任意位置都可以使用</small></span>
            </div>
            <div className="shortcut-list">
              {shortcutDefinitions.map((shortcut) => (
                <div className="shortcut-row" key={shortcut.action}>
                  <span>{shortcut.action}</span>
                  <span className="shortcut-keys" aria-label={shortcutTitle(shortcut.keys, isMac)}>
                    {displayShortcutKeys(shortcut.keys, isMac).map((key, index) => <kbd key={`${shortcut.action}-${key}-${index}`}>{key}</kbd>)}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <div className="settings-links"><Link href="/sources">数据来源</Link><Link href="/privacy">隐私说明</Link></div>
          <button className="danger-action" onClick={async () => { await storage.clearLearningData(); setProgress([]); setSessions([]); if (activeBook) await openBook(activeBook, true); setModal(null); }}>清空学习进度</button>
        </ModalShell>
      )}

      {modal === "history" && (
        <ModalShell title="Learning history" onClose={() => setModal(null)}>
          <div className="stats-grid"><div><strong>{progress.filter((item) => item.correct > 0).length}</strong><span>已学单词</span></div><div><strong>{progress.reduce((sum, item) => sum + item.correct, 0)}</strong><span>答对次数</span></div><div><strong>{progress.reduce((sum, item) => sum + item.wrong, 0)}</strong><span>错误次数</span></div></div>
          <p className="empty-note">学习记录只保存在当前浏览器中，不会上传到服务器。</p>
        </ModalShell>
      )}

      {modal === "import" && (
        <ModalShell title="Upload word book" onClose={() => { setModal(null); setImportResult(null); }}>
          <label className="upload-drop"><FileUp size={24} /><strong>选择 CSV 或 JSON 文件</strong><span>文件只会在当前浏览器中解析</span><input type="file" accept=".csv,.json,application/json,text/csv" onChange={(event) => event.target.files?.[0] && handleImport(event.target.files[0])} /></label>
          <div className="template-actions">
            <button onClick={() => downloadFile("chatwords-template.csv", "word,zh,en,example,phonetic,audio,aliases\nnegotiate,协商；谈判,to discuss in order to reach an agreement,We need to negotiate the terms before signing.,/nɪˈɡoʊʃieɪt/,,", "text/csv")}>下载 CSV 模板</button>
            <button onClick={() => downloadFile("chatwords-template.json", JSON.stringify({ name: "我的词本", words: [{ word: "negotiate", zh: ["协商；谈判"], en: ["to discuss in order to reach an agreement"], examples: ["We need to negotiate the terms before signing."], phonetic: "/nɪˈɡoʊʃieɪt/", answers: [] }] }, null, 2), "application/json")}>下载 JSON 模板</button>
          </div>
          {importResult && <div className="import-preview"><h3>{importResult.book ? `${importResult.book.count} 个词条可导入` : "没有可导入的词条"}</h3>{importResult.duplicates > 0 && <p>已忽略 {importResult.duplicates} 个重复词条。</p>}{importResult.errors.length > 0 && <ul>{importResult.errors.slice(0, 6).map((error) => <li key={error}>{error}</li>)}</ul>}{importResult.book && <button className="dark-action" onClick={saveImportedBook}>保存并开始学习</button>}</div>}
        </ModalShell>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
