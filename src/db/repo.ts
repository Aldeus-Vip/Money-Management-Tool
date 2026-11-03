import type { Database } from 'sql.js';
import { all, get, lastId, run, tx } from './sqlite';
import { shiftYM, type ISODate, type YM } from '../lib/date';
import { makeRange, paydayOf, type PaydayRule, type PeriodRange } from '../lib/period';

// ===== 型 =====
export type CategoryCode = 'food' | 'transport' | 'fun' | 'extra' | 'other' | 'income';

export interface Wallet { id: number; name: string; kind: string; sort: number; active: number }
export interface Category { code: CategoryCode; name: string; is_income: number; sort: number }
export interface Purpose {
  id: number; name: string; wallet_id: number | null; category_code: CategoryCode | null;
  is_charge: number; sort: number; active: number;
}
export interface Period {
  ym: YM; start_date: ISODate; salary: number; bonus: number; bonus_on: number; food_budget: number;
  charge_limit: number; fun_limit: number; saving_move: number; fun_move: number; extra_add: number; memo: string | null;
}
export interface FixedCost {
  id: number; name: string; withdraw_day: number | null; cycle_months: number; buffer: number;
  default_amount: number; sort: number; active: number;
}
export interface PeriodFixedCost { ym: YM; fixed_cost_id: number; name: string; withdraw_day: number | null; amount: number; paid: number }
export interface Transaction {
  id: number; date: ISODate; wallet_id: number; wallet_name: string; category_code: CategoryCode; category_name: string;
  purpose_id: number | null; purpose_name: string | null; is_charge: number; amount: number; memo: string | null;
  transfer_id: number | null;
}
export type TransactionInput = Pick<Transaction, 'date' | 'wallet_id' | 'category_code' | 'purpose_id' | 'amount' | 'memo'>;

// ===== 設定 =====
export interface Settings {
  paydayDay: number; paydayHolidays: boolean; bufferRate: number; avgRate: number; extraMin: number;
  pinHash: string | null; pinSalt: string | null;
  /** 期首残高の合計を自由枠に加算するか (Excel 方式)。繰越ルール確定までは既定 OFF */
  carryOpening: boolean;
}

export function getSettings(db: Database): Settings {
  const m = new Map(all<{ key: string; value: string }>(db, 'SELECT key, value FROM settings').map((r) => [r.key, r.value]));
  return {
    paydayDay: Number(m.get('payday_day') ?? 25),
    paydayHolidays: (m.get('payday_holidays') ?? '1') === '1',
    bufferRate: Number(m.get('fixed_buffer_rate') ?? 0.1),
    avgRate: Number(m.get('avg_rate') ?? 1.05),
    extraMin: Number(m.get('extra_min') ?? 5000),
    pinHash: m.get('pin_hash') ?? null,
    pinSalt: m.get('pin_salt') ?? null,
    carryOpening: m.get('carry_opening') === '1',
  };
}

export function setSetting(db: Database, key: string, value: string): void {
  run(db, 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

export const paydayRule = (s: Settings): PaydayRule => ({ day: s.paydayDay, holidays: s.paydayHolidays });

// ===== マスタ =====
export const listWallets = (db: Database, activeOnly = true) =>
  all<Wallet>(db, `SELECT * FROM wallets ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY sort, id`);

export const updateWallet = (db: Database, w: Pick<Wallet, 'id' | 'name' | 'active'>) =>
  run(db, 'UPDATE wallets SET name = ?, active = ? WHERE id = ?', [w.name, w.active, w.id]);

export const listCategories = (db: Database) => all<Category>(db, 'SELECT * FROM categories ORDER BY sort');

/** 用途: 使用回数の多い順 (ウォレット指定時はそのウォレットと共通のもの) */
export function listPurposes(db: Database, opts: { walletId?: number; activeOnly?: boolean } = {}) {
  const where: string[] = [];
  const params: (number | string)[] = [];
  if (opts.activeOnly ?? true) where.push('p.active = 1');
  if (opts.walletId) {
    where.push('(p.wallet_id IS NULL OR p.wallet_id = ?)');
    params.push(opts.walletId);
  }
  return all<Purpose & { uses: number }>(
    db,
    `SELECT p.*, (SELECT COUNT(*) FROM transactions t WHERE t.purpose_id = p.id) AS uses
       FROM purposes p ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY uses DESC, p.sort, p.id`,
    params,
  );
}

export function savePurpose(db: Database, p: Omit<Purpose, 'id' | 'sort'> & { id?: number }): number {
  if (p.id) {
    run(db, 'UPDATE purposes SET name=?, wallet_id=?, category_code=?, is_charge=?, active=? WHERE id=?', [
      p.name, p.wallet_id, p.category_code, p.is_charge, p.active, p.id,
    ]);
    return p.id;
  }
  run(db, 'INSERT INTO purposes (name, wallet_id, category_code, is_charge, active, sort) VALUES (?,?,?,?,?, (SELECT COALESCE(MAX(sort),0)+1 FROM purposes))', [
    p.name, p.wallet_id, p.category_code, p.is_charge, p.active,
  ]);
  return lastId(db);
}

export function findOrCreatePurpose(db: Database, name: string, category: CategoryCode): number {
  const hit = get<{ id: number }>(db, 'SELECT id FROM purposes WHERE name = ? ORDER BY active DESC LIMIT 1', [name]);
  if (hit) return hit.id;
  return savePurpose(db, { name, wallet_id: null, category_code: category, is_charge: 0, active: 1 });
}

export const listFixedCosts = (db: Database, activeOnly = false) =>
  all<FixedCost>(db, `SELECT * FROM fixed_costs ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY COALESCE(withdraw_day, 99), sort, id`);

export function saveFixedCost(db: Database, f: Omit<FixedCost, 'id' | 'sort'> & { id?: number }): number {
  if (f.id) {
    run(db, 'UPDATE fixed_costs SET name=?, withdraw_day=?, cycle_months=?, buffer=?, default_amount=?, active=? WHERE id=?', [
      f.name, f.withdraw_day, f.cycle_months, f.buffer, f.default_amount, f.active, f.id,
    ]);
    return f.id;
  }
  run(db, 'INSERT INTO fixed_costs (name, withdraw_day, cycle_months, buffer, default_amount, active, sort) VALUES (?,?,?,?,?,?, (SELECT COALESCE(MAX(sort),0)+1 FROM fixed_costs))', [
    f.name, f.withdraw_day, f.cycle_months, f.buffer, f.default_amount, f.active,
  ]);
  return lastId(db);
}

// ===== 期間 =====
export const getPeriod = (db: Database, key: YM) => get<Period>(db, 'SELECT * FROM periods WHERE ym = ?', [key]);

export const listPeriods = (db: Database) => all<Period>(db, 'SELECT * FROM periods ORDER BY ym DESC');

function startOf(db: Database, key: YM, rule: PaydayRule): ISODate {
  return getPeriod(db, key)?.start_date ?? paydayOf(key, rule);
}

/** 期間の開始日〜終了日。登録済みなら登録値、未登録なら給料日ルールで算出 */
export function periodRange(db: Database, key: YM): PeriodRange {
  const rule = paydayRule(getSettings(db));
  return makeRange(key, startOf(db, key, rule), startOf(db, shiftYM(key, 1), rule));
}

/** 日付が属する期間の ym */
export function ymForDate(db: Database, date: ISODate): YM {
  const key = date.slice(0, 7);
  return date < periodRange(db, key).start ? shiftYM(key, -1) : key;
}

export type PeriodInput = Omit<Period, 'ym' | 'memo'> & { memo?: string | null };

export function savePeriod(db: Database, key: YM, p: PeriodInput): void {
  run(
    db,
    `INSERT INTO periods (ym, start_date, salary, bonus, bonus_on, food_budget, charge_limit, fun_limit, saving_move, fun_move, extra_add, memo)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(ym) DO UPDATE SET start_date=excluded.start_date, salary=excluded.salary, bonus=excluded.bonus,
       bonus_on=excluded.bonus_on, food_budget=excluded.food_budget, charge_limit=excluded.charge_limit,
       fun_limit=excluded.fun_limit, saving_move=excluded.saving_move, fun_move=excluded.fun_move,
       extra_add=excluded.extra_add, memo=excluded.memo`,
    [key, p.start_date, p.salary, p.bonus, p.bonus_on, p.food_budget, p.charge_limit, p.fun_limit, p.saving_move, p.fun_move, p.extra_add, p.memo ?? null],
  );
}

/** 給料を登録して期間を開始: 期間行 + 有効な固定費 (推定額) を作成 */
export function startPeriod(db: Database, key: YM, p: PeriodInput): void {
  tx(db, () => {
    savePeriod(db, key, p);
    const rate = getSettings(db).bufferRate;
    for (const f of listFixedCosts(db, true)) {
      run(db, 'INSERT OR IGNORE INTO period_fixed_costs (ym, fixed_cost_id, amount) VALUES (?,?,?)', [key, f.id, estimateFixed(db, f, key, rate)]);
    }
  });
}

export function deletePeriod(db: Database, key: YM): void {
  tx(db, () => {
    run(db, 'DELETE FROM period_fixed_costs WHERE ym = ?', [key]);
    run(db, 'DELETE FROM periods WHERE ym = ?', [key]);
  });
}

// ===== 期間の固定費 =====
export const listPeriodFixedCosts = (db: Database, key: YM) =>
  all<PeriodFixedCost>(
    db,
    `SELECT pf.ym, pf.fixed_cost_id, f.name, f.withdraw_day, pf.amount, pf.paid
       FROM period_fixed_costs pf JOIN fixed_costs f ON f.id = pf.fixed_cost_id
      WHERE pf.ym = ? ORDER BY COALESCE(f.withdraw_day, 99), f.sort, f.id`,
    [key],
  );

export const setPeriodFixedAmount = (db: Database, key: YM, fixedCostId: number, amount: number) =>
  run(db, 'UPDATE period_fixed_costs SET amount = ? WHERE ym = ? AND fixed_cost_id = ?', [amount, key, fixedCostId]);

export function addFixedToPeriod(db: Database, key: YM, f: FixedCost): void {
  run(db, 'INSERT OR IGNORE INTO period_fixed_costs (ym, fixed_cost_id, amount) VALUES (?,?,?)', [key, f.id, estimateFixed(db, f, key, getSettings(db).bufferRate)]);
}

export const removeFixedFromPeriod = (db: Database, key: YM, fixedCostId: number) =>
  run(db, 'DELETE FROM period_fixed_costs WHERE ym = ? AND fixed_cost_id = ?', [key, fixedCostId]);

/**
 * 固定費の推定額 = 過去12期間の実額 (0 を除く) の平均 × (1 + バッファ率)。
 * 請求のある期間だけ記録されるため、隔月請求 (水道代など) も「1回あたりの額」になる
 * = Excel の「月平均 × 2」と同じ結果。履歴が無ければマスタの既定額。
 */
export function estimateFixed(db: Database, f: FixedCost, beforeYm: YM, bufferRate: number): number {
  const r = get<{ avg: number | null }>(
    db,
    `SELECT AVG(amount) AS avg FROM (
       SELECT amount FROM period_fixed_costs WHERE fixed_cost_id = ? AND ym < ? AND amount > 0 ORDER BY ym DESC LIMIT 12)`,
    [f.id, beforeYm],
  );
  const base = r?.avg ?? f.default_amount;
  return Math.round(base * (f.buffer ? 1 + bufferRate : 1));
}

// ===== 取引 =====
const TX_SELECT = `
  SELECT t.id, t.date, t.wallet_id, w.name AS wallet_name, t.category_code, c.name AS category_name,
         t.purpose_id, p.name AS purpose_name, COALESCE(p.is_charge, 0) AS is_charge, t.amount, t.memo, t.transfer_id
    FROM transactions t
    JOIN wallets w ON w.id = t.wallet_id
    JOIN categories c ON c.code = t.category_code
    LEFT JOIN purposes p ON p.id = t.purpose_id`;

export interface TxFilter { from?: ISODate; to?: ISODate; walletId?: number; category?: CategoryCode; text?: string }

export function listTransactions(db: Database, f: TxFilter = {}): Transaction[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (f.from) { where.push('t.date >= ?'); params.push(f.from); }
  if (f.to) { where.push('t.date <= ?'); params.push(f.to); }
  if (f.walletId) { where.push('t.wallet_id = ?'); params.push(f.walletId); }
  if (f.category) { where.push('t.category_code = ?'); params.push(f.category); }
  if (f.text) { where.push("(p.name LIKE ? OR t.memo LIKE ?)"); params.push(`%${f.text}%`, `%${f.text}%`); }
  return all<Transaction>(db, `${TX_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.date DESC, t.id DESC`, params);
}

export const getTransaction = (db: Database, id: number) => get<Transaction>(db, `${TX_SELECT} WHERE t.id = ?`, [id]);

export function saveTransaction(db: Database, t: TransactionInput & { id?: number }): number {
  const now = new Date().toISOString();
  if (t.id) {
    run(db, 'UPDATE transactions SET date=?, wallet_id=?, category_code=?, purpose_id=?, amount=?, memo=?, updated_at=? WHERE id=?', [
      t.date, t.wallet_id, t.category_code, t.purpose_id, t.amount, t.memo, now, t.id,
    ]);
    return t.id;
  }
  run(db, 'INSERT INTO transactions (date, wallet_id, category_code, purpose_id, amount, memo, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)', [
    t.date, t.wallet_id, t.category_code, t.purpose_id, t.amount, t.memo, now, now,
  ]);
  return lastId(db);
}

export const deleteTransaction = (db: Database, id: number) => run(db, 'DELETE FROM transactions WHERE id = ?', [id]);

/** 過去の登録済み期間 (最大12) ごとの区分別合計。推奨値の算出に使う */
export function pastPeriodTotals(db: Database, beforeYm: YM, limit = 12): Record<CategoryCode, number>[] {
  return all<Period>(db, 'SELECT * FROM periods WHERE ym < ? ORDER BY ym DESC LIMIT ?', [beforeYm, limit]).map((p) => {
    const r = periodRange(db, p.ym);
    const rows = all<{ category_code: CategoryCode; total: number }>(
      db,
      'SELECT category_code, SUM(amount) AS total FROM transactions WHERE date BETWEEN ? AND ? GROUP BY category_code',
      [r.start, r.end],
    );
    const o = { food: 0, transport: 0, fun: 0, extra: 0, other: 0, income: 0 } as Record<CategoryCode, number>;
    for (const x of rows) o[x.category_code] = x.total;
    return o;
  });
}


// =====================================================================
// Phase 2
// =====================================================================

/** デビットの引落先 = 最初の有効な銀行口座 */
export const bankWallet = (db: Database) => get<Wallet>(db, "SELECT * FROM wallets WHERE kind = 'bank' AND active = 1 ORDER BY sort, id LIMIT 1");

export const setFixedPaid = (db: Database, key: YM, fixedCostId: number, paid: boolean) =>
  run(db, 'UPDATE period_fixed_costs SET paid = ? WHERE ym = ? AND fixed_cost_id = ?', [paid ? 1 : 0, key, fixedCostId]);

// ===== 移動 =====
export interface Transfer {
  id: number; date: ISODate; from_wallet_id: number; from_name: string; to_wallet_id: number; to_name: string;
  amount: number; memo: string | null; fee: number;
}

export function listTransfers(db: Database, from?: ISODate, to?: ISODate): Transfer[] {
  return all<Transfer>(
    db,
    `SELECT tr.id, tr.date, tr.from_wallet_id, wf.name AS from_name, tr.to_wallet_id, wt.name AS to_name, tr.amount, tr.memo,
            COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.transfer_id = tr.id), 0) AS fee
       FROM transfers tr JOIN wallets wf ON wf.id = tr.from_wallet_id JOIN wallets wt ON wt.id = tr.to_wallet_id
      WHERE (? IS NULL OR tr.date >= ?) AND (? IS NULL OR tr.date <= ?)
      ORDER BY tr.date DESC, tr.id DESC`,
    [from ?? null, from ?? null, to ?? null, to ?? null],
  );
}

/** 移動を登録。手数料があれば移動元 (銀行) の「その他/手数料」取引として同時に登録 */
export function saveTransfer(db: Database, t: { date: ISODate; from_wallet_id: number; to_wallet_id: number; amount: number; memo?: string | null; fee?: number }): number {
  return tx(db, () => {
    run(db, 'INSERT INTO transfers (date, from_wallet_id, to_wallet_id, amount, memo) VALUES (?,?,?,?,?)', [t.date, t.from_wallet_id, t.to_wallet_id, t.amount, t.memo ?? null]);
    const id = lastId(db);
    if (t.fee && t.fee > 0) {
      const feeWallet = get<Wallet>(db, 'SELECT * FROM wallets WHERE id IN (?, ?) AND kind = \'bank\' ORDER BY id = ? DESC LIMIT 1', [t.from_wallet_id, t.to_wallet_id, t.from_wallet_id]);
      const now = new Date().toISOString();
      run(db, 'INSERT INTO transactions (date, wallet_id, category_code, purpose_id, amount, memo, created_at, updated_at, transfer_id) VALUES (?,?,?,?,?,?,?,?,?)', [
        t.date, feeWallet?.id ?? t.from_wallet_id, 'other', findOrCreatePurpose(db, '手数料', 'other'), t.fee, null, now, now, id,
      ]);
    }
    return id;
  });
}

export function deleteTransfer(db: Database, id: number): void {
  tx(db, () => {
    run(db, 'DELETE FROM transactions WHERE transfer_id = ?', [id]);
    run(db, 'DELETE FROM transfers WHERE id = ?', [id]);
  });
}

// ===== 期首残高・実残高 =====
export interface PeriodBalance { wallet_id: number; opening: number; actual: number | null }

export function listPeriodBalances(db: Database, key: YM): Map<number, PeriodBalance> {
  return new Map(all<PeriodBalance>(db, 'SELECT wallet_id, opening, actual FROM period_balances WHERE ym = ?', [key]).map((b) => [b.wallet_id, b]));
}

export const setOpening = (db: Database, key: YM, walletId: number, opening: number) =>
  run(db, 'INSERT INTO period_balances (ym, wallet_id, opening) VALUES (?,?,?) ON CONFLICT(ym, wallet_id) DO UPDATE SET opening = excluded.opening', [key, walletId, opening]);

export const setActual = (db: Database, key: YM, walletId: number, actual: number | null) =>
  run(db, 'INSERT INTO period_balances (ym, wallet_id, actual) VALUES (?,?,?) ON CONFLICT(ym, wallet_id) DO UPDATE SET actual = excluded.actual', [key, walletId, actual]);

// ===== プール =====
export interface Pool { id: number; code: 'saving' | 'fun'; name: string }
export interface PoolEntry { id: number; pool_id: number; pool_name: string; date: ISODate; kind: 'adjust' | 'use'; amount: number; purpose: string | null; memo: string | null }
export interface PoolStatus extends Pool { balance: number; moved: number; used: number }

export const listPools = (db: Database) => all<Pool>(db, 'SELECT id, code, name FROM pools ORDER BY sort, id');

export function listPoolEntries(db: Database, from?: ISODate, to?: ISODate): PoolEntry[] {
  return all<PoolEntry>(
    db,
    `SELECT e.id, e.pool_id, p.name AS pool_name, e.date, e.kind, e.amount, e.purpose, e.memo
       FROM pool_entries e JOIN pools p ON p.id = e.pool_id
      WHERE (? IS NULL OR e.date >= ?) AND (? IS NULL OR e.date <= ?)
      ORDER BY e.date DESC, e.id DESC`,
    [from ?? null, from ?? null, to ?? null, to ?? null],
  );
}

export function savePoolEntry(db: Database, e: { pool_id: number; date: ISODate; kind: 'adjust' | 'use'; amount: number; purpose?: string | null; memo?: string | null }): number {
  run(db, 'INSERT INTO pool_entries (pool_id, date, kind, amount, purpose, memo) VALUES (?,?,?,?,?,?)', [e.pool_id, e.date, e.kind, e.amount, e.purpose ?? null, e.memo ?? null]);
  return lastId(db);
}

export const deletePoolEntry = (db: Database, id: number) => run(db, 'DELETE FROM pool_entries WHERE id = ?', [id]);

/**
 * プール残高 (期間末時点) = 調整の合計 + 各期間の移動額 (この期間まで) − 使用の合計
 * Excel: 銀行口座!Q9 = 貯金仮移動後 − 使用額
 */
export function poolStatus(db: Database, key: YM): PoolStatus[] {
  const r = periodRange(db, key);
  return listPools(db).map((p) => {
    const col = p.code === 'saving' ? 'saving_move' : 'fun_move';
    const sum = (sql: string, params: (string | number)[]) => Number(get<{ v: number | null }>(db, sql, params)?.v ?? 0);
    const adjust = sum("SELECT SUM(amount) AS v FROM pool_entries WHERE pool_id = ? AND kind = 'adjust' AND date <= ?", [p.id, r.end]);
    const moves = sum(`SELECT SUM(${col}) AS v FROM periods WHERE ym <= ?`, [key]);
    const usesAll = sum("SELECT SUM(amount) AS v FROM pool_entries WHERE pool_id = ? AND kind = 'use' AND date <= ?", [p.id, r.end]);
    const used = sum("SELECT SUM(amount) AS v FROM pool_entries WHERE pool_id = ? AND kind = 'use' AND date BETWEEN ? AND ?", [p.id, r.start, r.end]);
    const moved = sum(`SELECT ${col} AS v FROM periods WHERE ym = ?`, [key]);
    return { ...p, balance: adjust + moves - usesAll, moved, used };
  });
}

/** 期間内のプール使用額 (口座に戻り、自由枠に加算される) */
export function poolUseTotal(db: Database, from: ISODate, to: ISODate): number {
  return Number(get<{ v: number | null }>(db, "SELECT SUM(amount) AS v FROM pool_entries WHERE kind = 'use' AND date BETWEEN ? AND ?", [from, to])?.v ?? 0);
}

// ===== 取り込み単位 (Excel 取り込みの準備) =====
export interface ImportBatch { id: number; source: string; imported_at: string; note: string | null; rows: number }

const BATCH_TABLES = ['transactions', 'transfers', 'periods', 'period_fixed_costs', 'period_balances', 'pool_entries', 'monthly_actuals'] as const;

export function createBatch(db: Database, source: string, note?: string): number {
  run(db, 'INSERT INTO import_batches (source, imported_at, note) VALUES (?,?,?)', [source, new Date().toISOString(), note ?? null]);
  return lastId(db);
}

export function listBatches(db: Database): ImportBatch[] {
  const counts = BATCH_TABLES.map((t) => `(SELECT COUNT(*) FROM ${t} WHERE batch_id = b.id)`).join(' + ');
  return all<ImportBatch>(db, `SELECT b.*, ${counts} AS rows FROM import_batches b ORDER BY b.id DESC`);
}

/** 取り込み単位ごと削除 (やり直し用)。手入力のデータには影響しない */
export function deleteBatch(db: Database, id: number): void {
  tx(db, () => {
    run(db, 'DELETE FROM transactions WHERE transfer_id IN (SELECT id FROM transfers WHERE batch_id = ?)', [id]);
    for (const t of BATCH_TABLES) run(db, `DELETE FROM ${t} WHERE batch_id = ?`, [id]);
    run(db, 'DELETE FROM import_batches WHERE id = ?', [id]);
  });
}

export const listMonthlyActuals = (db: Database, fromYm: YM, toYm: YM) =>
  all<{ ym: YM; item: string; amount: number }>(db, 'SELECT ym, item, amount FROM monthly_actuals WHERE ym BETWEEN ? AND ?', [fromYm, toYm]);
