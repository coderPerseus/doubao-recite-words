import type { StudySession, WordBook, WordProgress } from "./types";

const DB_NAME = "chatwords";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("books")) database.createObjectStore("books", { keyPath: "id" });
      if (!database.objectStoreNames.contains("sessions")) database.createObjectStore("sessions", { keyPath: "id" });
      if (!database.objectStoreNames.contains("progress")) database.createObjectStore("progress", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const database = await openDatabase();
  try {
    return await requestResult(database.transaction(storeName).objectStore(storeName).getAll());
  } finally {
    database.close();
  }
}

async function put<T>(storeName: string, value: T): Promise<void> {
  const database = await openDatabase();
  try {
    await requestResult(database.transaction(storeName, "readwrite").objectStore(storeName).put(value));
  } finally {
    database.close();
  }
}

export const storage = {
  getBooks: () => getAll<WordBook>("books"),
  saveBook: (book: WordBook) => put("books", book),
  async deleteBook(id: string): Promise<void> {
    const database = await openDatabase();
    try {
      await requestResult(database.transaction("books", "readwrite").objectStore("books").delete(id));
    } finally {
      database.close();
    }
  },
  getSessions: () => getAll<StudySession>("sessions"),
  saveSession: (session: StudySession) => put("sessions", session),
  async latestSession(bookId: string): Promise<StudySession | undefined> {
    const sessions = await getAll<StudySession>("sessions");
    return sessions
      .filter((session) => session.bookId === bookId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  },
  async replaceBookSession(session: StudySession): Promise<void> {
    const sessions = await getAll<StudySession>("sessions");
    const database = await openDatabase();
    try {
      const transaction = database.transaction("sessions", "readwrite");
      const store = transaction.objectStore("sessions");
      sessions
        .filter((item) => item.bookId === session.bookId && item.id !== session.id)
        .forEach((item) => store.delete(item.id));
      store.put(session);
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  },
  getProgress: async (): Promise<WordProgress[]> => {
    const rows = await getAll<WordProgress & { key: string }>("progress");
    return rows.map((row) => ({
      bookId: row.bookId,
      wordId: row.wordId,
      correct: row.correct,
      wrong: row.wrong,
      skipped: row.skipped,
      lastSeenAt: row.lastSeenAt,
    }));
  },
  saveProgress: (progress: WordProgress) => put("progress", { ...progress, key: `${progress.bookId}:${progress.wordId}` }),
  async clearLearningData(): Promise<void> {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(["sessions", "progress"], "readwrite");
      transaction.objectStore("sessions").clear();
      transaction.objectStore("progress").clear();
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  },
};
