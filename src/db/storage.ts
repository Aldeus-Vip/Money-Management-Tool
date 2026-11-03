import { idbDel, idbGet, idbSet } from './idb';

/**
 * DB の保存先。
 * - file:    ローカル / OneDrive 同期フォルダ上の .sqlite (File System Access API: PC の Chrome/Edge)
 * - browser: ブラウザ内 (IndexedDB)。スマホ等で File System Access が使えない場合の暫定
 */
export interface Storage {
  kind: 'file' | 'browser';
  label: string;
  load(): Promise<Uint8Array | null>;
  /** 外部で変更されていたら 'conflict' を返す (force で上書き) */
  save(bytes: Uint8Array, force?: boolean): Promise<'ok' | 'conflict'>;
}

export const fileApiSupported = () => typeof window !== 'undefined' && !!window.showOpenFilePicker;

const SQLITE_TYPES: FilePickerAcceptType[] = [
  { description: 'SQLite データベース', accept: { 'application/x-sqlite3': ['.sqlite', '.sqlite3', '.db'] } },
];

class FileStorage implements Storage {
  kind = 'file' as const;
  private lastModified = 0;
  constructor(private handle: FileSystemFileHandle) {}
  get label() {
    return this.handle.name;
  }
  async load() {
    const f = await this.handle.getFile();
    this.lastModified = f.lastModified;
    return f.size ? new Uint8Array(await f.arrayBuffer()) : null;
  }
  async save(bytes: Uint8Array, force = false) {
    const cur = await this.handle.getFile();
    if (!force && this.lastModified && cur.lastModified !== this.lastModified) return 'conflict';
    const w = await this.handle.createWritable();
    await w.write(bytes as unknown as ArrayBuffer);
    await w.close();
    this.lastModified = (await this.handle.getFile()).lastModified;
    return 'ok';
  }
}

class BrowserStorage implements Storage {
  kind = 'browser' as const;
  label = 'ブラウザ内保存';
  async load() {
    return (await idbGet<Uint8Array>('db-bytes')) ?? null;
  }
  async save(bytes: Uint8Array) {
    await idbSet('db-bytes', bytes);
    return 'ok' as const;
  }
}

const LAST = 'last-storage';

/** 既存の .sqlite を開く */
export async function pickExistingFile(): Promise<Storage> {
  const [h] = await window.showOpenFilePicker!({ types: SQLITE_TYPES, excludeAcceptAllOption: false });
  await idbSet(LAST, { kind: 'file', handle: h });
  return new FileStorage(h);
}

/** 新しい .sqlite を作成 */
export async function pickNewFile(): Promise<Storage> {
  const h = await window.showSaveFilePicker!({ types: SQLITE_TYPES, suggestedName: 'money.sqlite' });
  await idbSet(LAST, { kind: 'file', handle: h });
  return new FileStorage(h);
}

export async function useBrowserStorage(): Promise<Storage> {
  await idbSet(LAST, { kind: 'browser' });
  return new BrowserStorage();
}

export type Remembered = { kind: 'file'; handle: FileSystemFileHandle } | { kind: 'browser' };

export const getRemembered = () => idbGet<Remembered>(LAST).catch(() => undefined);
export const forgetRemembered = () => idbDel(LAST);

/** 前回の保存先を再開。ファイルの場合は権限の再確認が必要 (ユーザー操作の中で呼ぶこと) */
export async function resume(r: Remembered): Promise<Storage | null> {
  if (r.kind === 'browser') return new BrowserStorage();
  const opt = { mode: 'readwrite' as const };
  if ((await r.handle.queryPermission?.(opt)) !== 'granted' && (await r.handle.requestPermission?.(opt)) !== 'granted') return null;
  return new FileStorage(r.handle);
}

/** バックアップ用にダウンロード */
export function downloadBytes(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as unknown as ArrayBuffer], { type: 'application/x-sqlite3' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
