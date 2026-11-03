import type { PeriodData } from '../state/loadPeriod';
import { withdrawDate } from './budget';
import type { ISODate } from './date';

/**
 * 通帳形式の明細 (1 行ごとに残高を表示)。
 * 実際の残高と照合しながら 1 件ずつ入力し、金額の変化を追うための表示。
 * 最終行の残高 = 口座・残高画面の「現在の残高」と一致する。
 */
export interface LedgerRow {
  key: string;
  date: ISODate;
  kind: 'opening' | 'salary' | 'pool' | 'fixed' | 'tx' | 'transfer';
  label: string;
  sub?: string;
  amount: number; // + 入金 / − 出金
  balance: number;
  txId?: number;
  transferId?: number;
  category?: string;
}

const ORDER: Record<LedgerRow['kind'], number> = { opening: 0, salary: 1, pool: 2, fixed: 3, transfer: 4, tx: 5 };

export function buildLedger(d: PeriodData, walletId: number): LedgerRow[] {
  const bank = d.wallets.find((w) => w.kind === 'bank');
  const debitIds = new Set(d.wallets.filter((w) => w.kind === 'debit').map((w) => w.id));
  // デビットは口座の明細として表示
  const target = debitIds.has(walletId) && bank ? bank.id : walletId;
  const isBank = target === bank?.id;
  const bal = d.balances.find((b) => b.wallet.id === target);
  const rows: Omit<LedgerRow, 'balance'>[] = [];
  const p = d.period;
  const start = d.range.start;

  if (isBank && p) {
    if (p.salary) rows.push({ key: 'salary', date: start, kind: 'salary', label: '給料', amount: p.salary });
    if (p.bonus_on && p.bonus) rows.push({ key: 'bonus', date: start, kind: 'salary', label: '賞与', amount: p.bonus });
    if (p.saving_move) rows.push({ key: 'mv-saving', date: start, kind: 'pool', label: '貯金へ移動', amount: -p.saving_move });
    if (p.fun_move) rows.push({ key: 'mv-fun', date: start, kind: 'pool', label: '娯楽費へ移動', amount: -p.fun_move });
  }
  if (isBank) {
    for (const e of d.poolUses) rows.push({ key: `pu-${e.id}`, date: e.date, kind: 'pool', label: `${e.pool_name}から使用`, sub: e.purpose ?? undefined, amount: e.amount });
    for (const f of d.fixed.filter((x) => x.paid)) {
      rows.push({ key: `fx-${f.fixed_cost_id}`, date: withdrawDate(d.range, f.withdraw_day) ?? start, kind: 'fixed', label: f.name, sub: '固定費', amount: -f.actual });
    }
  }
  for (const t of d.transfers) {
    if (t.to_wallet_id === target) rows.push({ key: `tr-${t.id}-in`, date: t.date, kind: 'transfer', label: `${t.from_name}から`, sub: t.memo ?? '移動', amount: t.amount, transferId: t.id });
    if (t.from_wallet_id === target) rows.push({ key: `tr-${t.id}-out`, date: t.date, kind: 'transfer', label: `${t.to_name}へ`, sub: t.memo ?? '移動', amount: -t.amount, transferId: t.id });
  }
  for (const t of d.txs) {
    const owner = debitIds.has(t.wallet_id) && bank ? bank.id : t.wallet_id;
    if (owner !== target) continue;
    const income = t.category_code === 'income';
    rows.push({
      key: `tx-${t.id}`, date: t.date, kind: 'tx', label: t.purpose_name ?? t.category_name,
      sub: [t.category_name, debitIds.has(t.wallet_id) ? 'デビット' : '', t.memo ?? ''].filter(Boolean).join(' · '),
      amount: income ? t.amount : -t.amount, txId: t.id, category: t.category_code,
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || ORDER[a.kind] - ORDER[b.kind] || (a.txId ?? a.transferId ?? 0) - (b.txId ?? b.transferId ?? 0));

  let balance = bal?.opening ?? 0;
  const out: LedgerRow[] = [{ key: 'opening', date: start, kind: 'opening', label: '期首 (給料前)', amount: 0, balance }];
  for (const r of rows) {
    balance += r.amount;
    out.push({ ...r, balance });
  }
  return out;
}
