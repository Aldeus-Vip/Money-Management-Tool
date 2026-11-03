import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db/sqlite';
import * as repo from '../src/db/repo';

const base = (start: string): repo.PeriodInput => ({
  start_date: start, salary: 250000, bonus: 0, bonus_on: 0, food_budget: 50000,
  charge_limit: 0, fun_limit: 0, saving_move: 0, fun_move: 0, extra_add: 0,
});
const fc = (o: Partial<repo.FixedCost> & { name: string }) => ({
  withdraw_day: 10, cycle_months: 1, buffer: 0, default_amount: 1000, active: 1, mode: 'fixed' as const, bill_months: null, ...o,
});

describe('fixed cost schedules (請求月・予定)', () => {
  it('billing months: only billed costs enter a new period', async () => {
    const db = await openDb(null);
    repo.saveFixedCost(db, fc({ name: '水道', bill_months: '2,4,6,8,10,12', default_amount: 3000 }));
    repo.saveFixedCost(db, fc({ name: '年会費', bill_months: '5', default_amount: 12000 }));
    repo.saveFixedCost(db, fc({ name: '家賃', default_amount: 50000 }));
    repo.startPeriod(db, '2026-10', base('2026-10-23'));
    expect(repo.listPeriodFixedCosts(db, '2026-10').map((f) => f.name).sort()).toEqual(['家賃', '水道']);
    repo.startPeriod(db, '2026-11', base('2026-11-25'));
    expect(repo.listPeriodFixedCosts(db, '2026-11').map((f) => f.name)).toEqual(['家賃']);
    expect(repo.projectedFixed(db, '2027-05').map((f) => f.name).sort()).toEqual(['家賃', '年会費'].sort());
    expect(repo.monthsLabel('2,4,6,8,10,12')).toBe('偶数月');
    expect(repo.monthsLabel('5')).toBe('年1回 (5月)');
    expect(repo.monthsLabel(null)).toBe('毎月');
  });

  it('rule precedence: once > yearly > from > master', async () => {
    const db = await openDb(null);
    const id = repo.saveFixedCost(db, fc({ name: '送金', default_amount: 40000 }));
    repo.saveRule(db, { fixed_cost_id: id, kind: 'from', ym: '2026-09', month: null, amount: 45000, note: null });
    repo.saveRule(db, { fixed_cost_id: id, kind: 'yearly', ym: null, month: 6, amount: 100000, note: null });
    repo.saveRule(db, { fixed_cost_id: id, kind: 'once', ym: '2027-06', month: null, amount: 120000, note: '臨時' });
    const est = (ym: string) => repo.estimateDetail(db, { id, mode: 'fixed', buffer: 0, default_amount: 40000 }, ym, 0.1);
    expect(est('2026-08')).toMatchObject({ amount: 40000, source: 'fixed' });
    expect(est('2026-09')).toMatchObject({ amount: 45000, source: 'from' });
    expect(est('2026-06')).toMatchObject({ amount: 100000, source: 'yearly' });
    expect(est('2027-06')).toMatchObject({ amount: 120000, source: 'once' });
    expect(est('2027-07')).toMatchObject({ amount: 45000, source: 'from' });
  });

  it('once / yearly rules bill the month even outside billing months; notices', async () => {
    const db = await openDb(null);
    const id = repo.saveFixedCost(db, fc({ name: 'サブスクB', bill_months: '12', default_amount: 5000 }));
    const rent = repo.saveFixedCost(db, fc({ name: '家賃', default_amount: 50000 }));
    repo.saveRule(db, { fixed_cost_id: id, kind: 'once', ym: '2026-11', month: null, amount: 2000, note: '追加分' });
    repo.saveRule(db, { fixed_cost_id: rent, kind: 'from', ym: '2026-11', month: null, amount: 54000, note: null });
    expect(repo.isBilled(repo.listFixedCosts(db)[0], repo.listRules(db, id), '2026-11')).toBe(true);
    const n = repo.fixedNotices(db, '2026-11');
    expect(n.find((x) => x.name === '家賃')).toMatchObject({ kind: 'change', text: 'この期間から金額変更 ¥50,000 → ¥54,000' });
    expect(n.find((x) => x.name === 'サブスクB')).toMatchObject({ kind: 'once' });
    expect(repo.fixedNotices(db, '2026-10').find((x) => x.name === 'サブスクB')).toBeUndefined(); // 前月も請求なし → 表示しない
    expect(repo.fixedNotices(db, '2027-01').find((x) => x.name === 'サブスクB')).toMatchObject({ kind: 'skip' }); // 12月の次
    expect(repo.fixedNotices(db, '2026-12').find((x) => x.name === 'サブスクB')).toMatchObject({ kind: 'billed', amount: 5000 });
    // 予定の自動額は期間の行にも反映 (自動のまま)
    repo.startPeriod(db, '2026-11', base('2026-11-25'));
    const row = repo.listPeriodFixedCosts(db, '2026-11').find((f) => f.name === '家賃')!;
    expect(row).toMatchObject({ planned: 54000, auto_source: 'from', planned_input: null });
  });
});
