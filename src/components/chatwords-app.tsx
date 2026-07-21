"use client";

import {
  BookOpen,
  Check,
  ChevronDown,
  Ellipsis,
  FileUp,
  History,
  Menu,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  Share,
  SkipForward,
  Speaker,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseWordBook, type ImportResult } from "@/lib/import-wordbook";
import { createSession, hintFor, isCorrectAnswer, maskExample, recordProgress } from "@/lib/study";
import { storage } from "@/lib/storage";
import type { StudySession, UserSettings, WordBook, WordBookSummary, WordEntry, WordProgress } from "@/lib/types";

const defaultSettings: UserSettings = {
  theme: "light",
  autoPlay: false,
  speechRate: 0.9,
  sessionSize: 20,
};

type ModalName = "library" | "settings" | "history" | "import" | null;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function progressPercent(book: WordBookSummary, progress: WordProgress[]) {
  const learned = progress.filter((item) => item.bookId === book.id && item.correct > 0).length;
  return Math.min(100, Math.round((learned / Math.max(book.count, 1)) * 100));
}

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function AssistantMark() {
  return <div className="assistant-mark" aria-hidden="true">cw</div>;
}

function Clue({ entry, showHint, onSpeak }: { entry: WordEntry; showHint: boolean; onSpeak: () => void }) {
  return (
    <div className="assistant-row reveal-message">
      <AssistantMark />
      <div className="assistant-copy">
        <p className="clue-kicker">中文释义</p>
        <p className="clue-zh">{entry.zh.join("；")}</p>
        <p className="clue-kicker clue-section">English definition</p>
        <p>{entry.en[0]}</p>
        <blockquote>{maskExample(entry.examples[0], entry)}</blockquote>
        <div className="clue-tools">
          <button className="icon-text-button" onClick={onSpeak} type="button" aria-label="播放发音">
            <Speaker size={16} strokeWidth={1.8} />
            {entry.phonetic ? <span>{entry.phonetic}</span> : <span>听发音</span>}
          </button>
          {showHint && <span className="hint-chip">提示：{hintFor(entry)}</span>}
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
          <div className="response-actions">
            <button onClick={onSpeak} type="button" aria-label={`播放 ${entry.word} 的发音`}><Speaker size={15} /></button>
          </div>
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  const getBook = useCallback(async (summary: WordBookSummary, customs = customBooks): Promise<WordBook> => {
    if (!summary.builtIn) {
      const custom = customs.find((book) => book.id === summary.id);
      if (!custom) throw new Error("找不到这个自定义词本");
      return custom;
    }
    const response = await fetch(`/data/books/${summary.id}.json`);
    if (!response.ok) throw new Error("词本加载失败");
    return response.json() as Promise<WordBook>;
  }, [customBooks]);

  const openBook = useCallback(async (summary: WordBookSummary, fresh = false, customs = customBooks, nextSettings = settings) => {
    setLoading(true);
    setAnswer("");
    setAnswerError("");
    try {
      const book = await getBook(summary, customs);
      const existing = fresh ? undefined : await storage.latestSession(book.id);
      const nextSession = existing ?? createSession(book.id, book.words.map((word) => word.id), nextSettings.sessionSize);
      if (!existing) await storage.saveSession(nextSession);
      setActiveBook(book);
      setSession(nextSession);
      localStorage.setItem("chatwords:book", book.id);
      setSidebarOpen(false);
    } finally {
      setLoading(false);
    }
  }, [customBooks, getBook, settings]);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      const storedSettings = JSON.parse(localStorage.getItem("chatwords:settings") || "null") as UserSettings | null;
      const initialSettings = storedSettings ? { ...defaultSettings, ...storedSettings } : defaultSettings;
      const [manifestResponse, savedBooks, savedProgress] = await Promise.all([
        fetch("/data/manifest.json"), storage.getBooks(), storage.getProgress(),
      ]);
      const manifest = await manifestResponse.json() as WordBookSummary[];
      if (cancelled) return;
      setSettings(initialSettings);
      setBooks(manifest);
      setCustomBooks(savedBooks);
      setProgress(savedProgress);
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
    const dark = settings.theme === "dark" || (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
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
    const fallback = () => {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(entry.word);
      utterance.lang = "en-US";
      utterance.rate = settings.speechRate;
      speechSynthesis.speak(utterance);
    };
    if (!entry.audio) return fallback();
    const audio = new Audio(entry.audio);
    audio.playbackRate = settings.speechRate;
    audio.onerror = fallback;
    audio.play().catch(fallback);
  }, [settings.speechRate]);

  async function finishTurn(result: "correct" | "skipped") {
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
    setAnswer("");
    setAnswerError("");
    setIsTyping(true);
    await Promise.all([storage.saveSession(nextSession), storage.saveProgress(nextProgress)]);
    if (settings.autoPlay) speak(currentEntry);
    window.setTimeout(() => setIsTyping(false), 420);
  }

  async function submitAnswer(event: FormEvent) {
    event.preventDefault();
    if (!answer.trim() || !currentEntry || !session || isTyping) return;
    if (isCorrectAnswer(answer, currentEntry)) {
      await finishTurn("correct");
      return;
    }
    const nextSession = { ...session, wrongAttempts: session.wrongAttempts + 1 };
    setSession(nextSession);
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

  return (
    <div className={cn("app-shell", sidebarCollapsed && "sidebar-collapsed")}>
      <aside className={cn("sidebar", sidebarOpen && "sidebar-mobile-open")}>
        <div className="sidebar-top">
          <button className="brand" onClick={() => activeBook && openBook(activeBook, true)} aria-label="chatWords 新练习">chatWords</button>
          <div className="sidebar-top-actions">
            <button aria-label="搜索词本" onClick={() => setModal("library")}><Search size={18} /></button>
            <button aria-label="收起侧边栏" onClick={() => setSidebarCollapsed(true)}><PanelLeftClose size={18} /></button>
          </div>
        </div>
        <nav className="primary-nav" aria-label="主导航">
          <button onClick={() => activeBook && openBook(activeBook, true)}><MessageSquarePlus size={17} />New chat</button>
          <button onClick={() => setModal("library")}><BookOpen size={17} />Library</button>
          <button onClick={() => setModal("history")}><History size={17} />History</button>
          <button onClick={() => setModal("import")}><FileUp size={17} />Upload word book</button>
        </nav>
        <div className="sidebar-scroll">
          <div className="sidebar-label">Word books</div>
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
          <div className="sidebar-label chats-label">Chats</div>
          <button className="history-item active">{activeBook?.name ?? "今日练习"}</button>
          <button className="history-item">昨天的错词复习</button>
          <button className="history-item">程序员英语 · Chapter 1</button>
          <button className="history-item">职场会议常用词</button>
        </div>
        <button className="profile-button" onClick={() => setModal("settings")}>
          <span className="profile-avatar">cw</span><span><strong>Local learner</strong><small>数据仅保存在本机</small></span><Settings size={16} />
        </button>
      </aside>

      {sidebarOpen && <button className="mobile-scrim" onClick={() => setSidebarOpen(false)} aria-label="关闭侧边栏" />}

      <main className="chat-main">
        <header className="chat-header">
          <div className="header-left">
            <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="打开侧边栏"><Menu size={20} /></button>
            {sidebarCollapsed && <button className="desktop-open-sidebar" onClick={() => setSidebarCollapsed(false)} aria-label="打开侧边栏"><PanelLeftOpen size={19} /></button>}
            <button className="model-button">chatWords <ChevronDown size={15} /></button>
          </div>
          <div className="header-actions">
            <button onClick={async () => { await navigator.clipboard.writeText(location.href); setToast("链接已复制"); }}><Share size={17} /> <span>Share</span></button>
            <button aria-label="打开设置" onClick={() => setModal("settings")}><Ellipsis size={19} /></button>
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
            {answerError && <div className="answer-error" role="status">{answerError}</div>}
            <form className={cn("composer", answerError && "composer-error")} onSubmit={submitAnswer}>
              <button className="composer-plus" type="button" onClick={() => setModal("library")} aria-label="选择词本"><Plus size={21} /></button>
              <textarea
                ref={inputRef}
                value={answer}
                onChange={(event) => { setAnswer(event.target.value); setAnswerError(""); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                disabled={finished || loading || isTyping}
                placeholder={finished ? "这轮练习已完成" : "Message chatWords"}
                aria-label="输入你猜到的单词"
              />
              <button className="skip-button" type="button" disabled={!currentEntry || isTyping} onClick={() => finishTurn("skipped")}><SkipForward size={16} /><span>Skip</span></button>
              <button className="send-button" type="submit" disabled={!answer.trim() || finished || isTyping} aria-label="发送答案"><SendHorizontal size={18} /></button>
            </form>
            <p className="disclaimer">chatWords can make mistakes. Check important definitions.</p>
          </div>
        </div>
      </main>

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
          <div className="settings-list">
            <label><span><strong>主题</strong><small>跟随你的办公环境</small></span><select value={settings.theme} onChange={(event) => setSettings({ ...settings, theme: event.target.value as UserSettings["theme"] })}><option value="light">浅色</option><option value="dark">深色</option><option value="system">跟随系统</option></select></label>
            <label><span><strong>每组词数</strong><small>新练习会使用这个数量</small></span><select value={settings.sessionSize} onChange={(event) => setSettings({ ...settings, sessionSize: event.target.value === "all" ? "all" : Number(event.target.value) as 10 | 20 | 50 })}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="all">全部</option></select></label>
            <label><span><strong>答对后播放发音</strong><small>音频不可用时使用浏览器朗读</small></span><input type="checkbox" checked={settings.autoPlay} onChange={(event) => setSettings({ ...settings, autoPlay: event.target.checked })} /></label>
            <label><span><strong>发音速度</strong><small>{settings.speechRate.toFixed(1)}×</small></span><input type="range" min="0.6" max="1.2" step="0.1" value={settings.speechRate} onChange={(event) => setSettings({ ...settings, speechRate: Number(event.target.value) })} /></label>
          </div>
          <div className="settings-links"><Link href="/sources">数据来源</Link><Link href="/privacy">隐私说明</Link></div>
          <button className="danger-action" onClick={async () => { await storage.clearLearningData(); setProgress([]); if (activeBook) await openBook(activeBook, true); setModal(null); }}>清空学习进度</button>
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
