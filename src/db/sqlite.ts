import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';
import { migrate } from './schema';

let sqlPromise: Promise<SqlJsStatic> | null = null;

/** sql.js (SQLite WASM) の初期化。wasmUrl はブラウザ時のみ指定 */
export function loadSql(wasmUrl?: string): Promise<SqlJsStatic> {
  sqlPromise ??= initSqlJs(wasmUrl ? { locateFile: () => wasmUrl } : undefined);
  return sqlPromise;
}

/** バイト列から DB を開く (null なら新規作成) し、スキーマを最新化 */
export async function openDb(bytes: Uint8Array | null, wasmUrl?: string): Promise<Database> {
  const SQL = await loadSql(wasmUrl);
  const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}

export type Params = SqlValue[] | Record<string, SqlValue>;

export function all<T>(db: Database, sql: string, params: Params = []): T[] {
  const st = db.prepare(sql);
  try {
    st.bind(params);
    const rows: T[] = [];
    while (st.step()) rows.push(st.getAsObject() as T);
    return rows;
  } finally {
    st.free();
  }
}

export function get<T>(db: Database, sql: string, params: Params = []): T | undefined {
  return all<T>(db, sql, params)[0];
}

export function run(db: Database, sql: string, params: Params = []): void {
  db.run(sql, params);
}

export function lastId(db: Database): number {
  return Number(db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
}

export function tx<T>(db: Database, fn: () => T): T {
  db.run('BEGIN');
  try {
    const r = fn();
    db.run('COMMIT');
    return r;
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}
