import * as repo from '../db/repo';
import { useApp, useQuery } from './AppContext';
import { recommend, summarize } from '../lib/budget';

/** 選択中の期間のデータ一式 */
export function usePeriodData() {
  const { ym } = useApp();
  return useQuery((db) => {
    const settings = repo.getSettings(db);
    const range = repo.periodRange(db, ym);
    const period = repo.getPeriod(db, ym) ?? null;
    const txs = repo.listTransactions(db, { from: range.start, to: range.end });
    const fixed = period ? repo.listPeriodFixedCosts(db, ym) : [];
    const fixedTotal = fixed.reduce((s, f) => s + f.amount, 0);
    const summary = period ? summarize(period, txs, fixedTotal) : null;
    const rec = recommend(repo.pastPeriodTotals(db, ym), settings.avgRate, settings.extraMin);
    return { ym, settings, range, period, txs, fixed, fixedTotal, summary, rec };
  }, [ym]);
}
