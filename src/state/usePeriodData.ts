import * as repo from '../db/repo';
import { useApp, useQuery } from './AppContext';
import { loadPeriod } from './loadPeriod';

/** 選択中の期間のデータ一式 */
export function usePeriodData() {
  const { ym } = useApp();
  return useQuery((db) => ({ ...loadPeriod(db, ym, { withRecommend: true }), pools: repo.poolStatus(db, ym) }), [ym]);
}
