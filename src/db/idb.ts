/** 最小限の IndexedDB key-value (ファイルハンドル・ブラウザ内DBの保存用) */
const DB = 'mse-money';
const STORE = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function call<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export const idbGet = <T>(key: string) => call<T | undefined>('readonly', (s) => s.get(key));
export const idbSet = (key: string, value: unknown) => call<void>('readwrite', (s) => s.put(value, key));
export const idbDel = (key: string) => call<void>('readwrite', (s) => s.delete(key));
