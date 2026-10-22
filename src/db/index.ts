import { STORAGE_KEYS } from '@/constants';
import type { TotpEntry } from '@/types/totp';

const DB_NAME = 'dtop';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

let databasePromise: Promise<IDBDatabase> | null = null;
let fallbackMode = false;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持 IndexedDB'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开本地数据库'));
    request.onblocked = () => reject(new Error('本地数据库被其他标签页占用，请关闭后重试'));
  });
}

async function getDatabase(): Promise<IDBDatabase | null> {
  if (fallbackMode) return null;
  try {
    databasePromise ??= openDatabase();
    return await databasePromise;
  } catch (error) {
    // 隐私模式 / 浏览器限制时回退到 localStorage，保证应用仍可用
    console.warn('[dtop] IndexedDB 不可用，已切换到 localStorage 回退模式', error);
    fallbackMode = true;
    databasePromise = null;
    return null;
  }
}

function readFallback(): TotpEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.entriesFallback);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as TotpEntry[]) : [];
  } catch {
    return [];
  }
}

function writeFallback(entries: TotpEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.entriesFallback, JSON.stringify(entries));
  } catch (error) {
    console.error('[dtop] 写入 localStorage 失败', error);
    throw new Error('本地存储空间不足或不可用');
  }
}

function runRequest<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = executor(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('数据库读取失败'));
    transaction.onabort = () => reject(transaction.error ?? new Error('数据库事务已中止'));
  });
}

function runWrite(db: IDBDatabase, executor: (store: IDBObjectStore) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    executor(transaction.objectStore(STORE_NAME));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('数据库写入失败'));
    transaction.onabort = () => reject(transaction.error ?? new Error('数据库事务已中止'));
  });
}

export async function getAllEntries(): Promise<TotpEntry[]> {
  const db = await getDatabase();
  if (!db) return readFallback();
  try {
    const rows = await runRequest<TotpEntry[]>(db, 'readonly', (store) => store.getAll());
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.warn('[dtop] 读取 IndexedDB 失败，使用 localStorage 回退', error);
    return readFallback();
  }
}

export async function saveEntry(entry: TotpEntry): Promise<void> {
  const db = await getDatabase();
  if (!db) {
    const rows = readFallback().filter((item) => item.id !== entry.id);
    rows.push(entry);
    writeFallback(rows);
    return;
  }
  await runWrite(db, (store) => store.put(entry));
}

export async function saveEntries(entries: TotpEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const db = await getDatabase();
  if (!db) {
    const map = new Map(readFallback().map((item) => [item.id, item]));
    entries.forEach((entry) => map.set(entry.id, entry));
    writeFallback([...map.values()]);
    return;
  }
  await runWrite(db, (store) => {
    entries.forEach((entry) => store.put(entry));
  });
}

export async function removeEntry(id: string): Promise<void> {
  const db = await getDatabase();
  if (!db) {
    writeFallback(readFallback().filter((item) => item.id !== id));
    return;
  }
  await runWrite(db, (store) => store.delete(id));
}

/** 用给定数据完整替换本地库 */
export async function replaceEntries(entries: TotpEntry[]): Promise<void> {
  const db = await getDatabase();
  if (!db) {
    writeFallback(entries);
    return;
  }
  await runWrite(db, (store) => {
    store.clear();
    entries.forEach((entry) => store.put(entry));
  });
}

export async function clearEntries(): Promise<void> {
  const db = await getDatabase();
  if (!db) {
    writeFallback([]);
    return;
  }
  await runWrite(db, (store) => store.clear());
}
