import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { openDb } from '../db/sqlite';
import * as repo from '../db/repo';
import type { Storage } from '../db/storage';
import { todayISO, type YM } from '../lib/date';
import { hashPin, verifyPin } from '../lib/pin';

type Phase = 'connect' | 'setPin' | 'locked' | 'ready';
export type SaveState = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';

interface Toast { id: number; text: string; tone: 'ok' | 'warn' | 'danger' }

interface Ctx {
  phase: Phase;
  db: Database;
  storage: Storage | null;
  /** DB 更新のたびに増える。useMemo の依存に使う */
  rev: number;
  saveState: SaveState;
  ym: YM;
  setYm: (k: YM) => void;
  connect: (s: Storage) => Promise<void>;
  disconnect: () => void;
  /** DB を書き換える処理はすべてこれを通す (自動保存される) */
  mutate: <T>(fn: (db: Database) => T) => T;
  saveNow: (force?: boolean) => Promise<void>;
  /** 外部で更新されていれば読み直す (manual = 結果をトーストで通知) */
  refresh: (manual?: boolean) => Promise<boolean>;
  setPin: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  toasts: Toast[];
}

const AppCtx = createContext<Ctx | null>(null);

const AUTO_LOCK_MS = 10 * 60 * 1000;
const SAVE_DELAY_MS = 500;

export function AppProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('connect');
  const [db, setDb] = useState<Database | null>(null);
  const [storage, setStorage] = useState<Storage | null>(null);
  const [rev, setRev] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [ym, setYm] = useState<YM>(todayISO().slice(0, 7));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const dbRef = useRef<Database | null>(null);
  const storageRef = useRef<Storage | null>(null);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const saveNow = useCallback(async (force = false) => {
    const d = dbRef.current;
    const s = storageRef.current;
    if (!d || !s) return;
    window.clearTimeout(timer.current);
    setSaveState('saving');
    try {
      const r = await s.save(d.export(), force);
      setSaveState(r === 'ok' ? 'saved' : 'conflict');
    } catch (e) {
      console.error(e);
      setSaveState('error');
    }
  }, []);

  const connect = useCallback(async (s: Storage) => {
    const d = await openDb(await s.load(), wasmUrl);
    dbRef.current = d;
    storageRef.current = s;
    setDb(d);
    setStorage(s);
    setYm(repo.ymForDate(d, todayISO()));
    const st = repo.getSettings(d);
    setPhase(st.pinHash ? 'locked' : 'setPin');
    // 新規作成 / マイグレーション結果を即保存
    await saveNow(true);
  }, [saveNow]);

  /**
   * 外部で更新されたファイルの読み直し (別の端末・OneDrive 同期の変更を反映)。
   * 未保存の変更があるときは上書きを防ぐため読み直さない (保存時に「外部で変更あり」として扱う)。
   */
  const saveStateRef = useRef<SaveState>('saved');
  saveStateRef.current = saveState;
  const refreshing = useRef(false);
  const refresh = useCallback(async (manual = false): Promise<boolean> => {
    const s = storageRef.current;
    if (!s?.changedExternally || refreshing.current) return false;
    if (saveStateRef.current !== 'saved') return false;
    refreshing.current = true;
    try {
      if (!(await s.changedExternally())) {
        if (manual) toast('最新の状態です');
        return false;
      }
      const d = await openDb(await s.load(), wasmUrl);
      if (saveStateRef.current !== 'saved') return false; // 読み込み中に入力された場合は破棄
      dbRef.current?.close();
      dbRef.current = d;
      setDb(d);
      setRev((v) => v + 1);
      toast('別の端末の変更を読み込みました');
      return true;
    } catch (e) {
      console.error(e);
      return false;
    } finally {
      refreshing.current = false;
    }
  }, [toast]);

  // アプリに戻ったとき / 開いている間 30 秒ごとに確認
  useEffect(() => {
    if (phase !== 'ready' && phase !== 'locked') return;
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const t = window.setInterval(onVisible, 30_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(t);
    };
  }, [phase, refresh]);

  const disconnect = useCallback(() => {
    dbRef.current?.close();
    dbRef.current = null;
    storageRef.current = null;
    setDb(null);
    setStorage(null);
    setPhase('connect');
  }, []);

  const mutate = useCallback(<T,>(fn: (db: Database) => T): T => {
    const d = dbRef.current;
    if (!d) throw new Error('DB 未接続');
    const r = fn(d);
    setRev((v) => v + 1);
    setSaveState('pending');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void saveNow(), SAVE_DELAY_MS);
    return r;
  }, [saveNow]);

  const setPin = useCallback(async (pin: string) => {
    const { hash, salt } = await hashPin(pin);
    mutate((d) => {
      repo.setSetting(d, 'pin_hash', hash);
      repo.setSetting(d, 'pin_salt', salt);
    });
    setPhase('ready');
  }, [mutate]);

  const unlock = useCallback(async (pin: string) => {
    const s = dbRef.current && repo.getSettings(dbRef.current);
    if (!s?.pinHash || !s.pinSalt) return false;
    const ok = await verifyPin(pin, s.pinHash, s.pinSalt);
    if (ok) setPhase('ready');
    return ok;
  }, []);

  const lock = useCallback(() => setPhase((p) => (p === 'ready' ? 'locked' : p)), []);

  // 無操作で自動ロック
  useEffect(() => {
    if (phase !== 'ready') return;
    let t = window.setTimeout(lock, AUTO_LOCK_MS);
    const reset = () => {
      window.clearTimeout(t);
      t = window.setTimeout(lock, AUTO_LOCK_MS);
    };
    const ev = ['pointerdown', 'keydown', 'scroll'] as const;
    ev.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(t);
      ev.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [phase, lock]);

  // 未保存のまま閉じない
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (saveState === 'pending' || saveState === 'saving' || saveState === 'error' || saveState === 'conflict') e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [saveState]);

  const value = useMemo<Ctx>(
    () => ({
      phase, db: db as Database, storage, rev, saveState, ym, setYm, connect, disconnect, mutate, saveNow, refresh, setPin, unlock, lock, toast, toasts,
    }),
    [phase, db, storage, rev, saveState, ym, connect, disconnect, mutate, saveNow, refresh, setPin, unlock, lock, toast, toasts],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('AppProvider がありません');
  return c;
}

/** DB から読む値を rev 連動でメモ化 */
export function useQuery<T>(fn: (db: Database) => T, deps: unknown[] = []): T {
  const { db, rev } = useApp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => fn(db), [db, rev, ...deps]);
}
