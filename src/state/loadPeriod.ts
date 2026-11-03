import type { Database } from 'sql.js';
import * as repo from '../db/repo';
import { recommend, summarize } from '../lib/budget';
import { computeBalances } from '../lib/balances';
import type { YM } from '../lib/date';

/** 期間のデータ一式 (画面・前期間の引継ぎ候補・分析で共用) */
export function loadPeriod(db: Database, ym: YM, opts: { withRecommend?: boolean } = {}) {
  const settings = repo.getSettings(db);
  const range = repo.periodRange(db, ym);
  const period = repo.getPeriod(db, ym) ?? null;
  const txs = repo.listTransactions(db, { from: range.start, to: range.end });
  const transfers = repo.listTransfers(db, range.start, range.end);
  const fixed = period ? repo.listPeriodFixedCosts(db, ym) : [];
  // 予算の計算は予算額、口座残高は引落額 (Excel: 目的設定 D 列 / 銀行口座 F 列)
  const fixedTotal = fixed.reduce((s, f) => s + f.planned, 0);
  const wallets = repo.listWallets(db);
  const poolUses = repo.listPoolEntries(db, range.start, range.end).filter((e) => e.kind === 'use');
  const poolUse = poolUses.reduce((a, e) => a + e.amount, 0);
  const balances = computeBalances({ wallets, balances: repo.listPeriodBalances(db, ym), period, txs, transfers, fixed, poolUse });
  const openingTotal = balances.filter((b) => !b.merged).reduce((s, b) => s + b.opening, 0);
  const carry = settings.carryOpening ? openingTotal : 0;
  const summary = period ? summarize(period, txs, fixedTotal, { poolUse, carry }) : null;
  const rec = opts.withRecommend
    ? recommend(repo.pastPeriodTotals(db, ym), settings.avgRate, settings.extraMin)
    : { food: null, extra: null };
  return { ym, settings, range, period, txs, transfers, fixed, fixedTotal, wallets, balances, openingTotal, poolUse, poolUses, carry, summary, rec };
}

export type PeriodData = ReturnType<typeof loadPeriod>;
