import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db/sqlite';
import * as repo from '../src/db/repo';

const base = (start: string): repo.PeriodInput => ({
  start_date: start, salary: 250000, bonus: 0, bonus_on: 0, food_budget: 50000,
  charge_limit: 3000, fun_limit: 8000, saving_move: 0, fun_move: 0, extra_add: 0,
});

describe('repo', () => {
  it('creates schema with seeds and survives export/reopen', async () => {
    const db = await openDb(null);
    expect(repo.listWallets(db).map((w) => w.name)).toEqual(['普通口座', 'デビット', '現金', 'PayPay', 'Suica']);
    repo.setSetting(db, 'payday_holidays', '0');
    const db2 = await openDb(db.export());
    expect(repo.getSettings(db2).paydayHolidays).toBe(false);
    expect(repo.listCategories(db2)).toHaveLength(6);
  });

  it('resolves periods by payday and registered start dates', async () => {
    const db = await openDb(null);
    expect(repo.periodRange(db, '2026-10')).toMatchObject({ start: '2026-10-23', end: '2026-11-24', days: 33 });
    expect(repo.ymForDate(db, '2026-10-22')).toBe('2026-09');
    expect(repo.ymForDate(db, '2026-10-23')).toBe('2026-10');
    expect(repo.ymForDate(db, '2026-11-24')).toBe('2026-10');
    // 実際の給料日が違った場合は登録値を優先
    repo.savePeriod(db, '2026-11', base('2026-11-20'));
    expect(repo.periodRange(db, '2026-10').end).toBe('2026-11-19');
  });

  it('estimates fixed costs from history with buffer (bimonthly = per-bill average)', async () => {
    const db = await openDb(null);
    const water = repo.saveFixedCost(db, { name: '水道', withdraw_day: 28, cycle_months: 2, buffer: 1, default_amount: 3000, active: 1 });
    repo.startPeriod(db, '2026-08', base('2026-08-25'));
    expect(repo.listPeriodFixedCosts(db, '2026-08')[0].amount).toBe(3300); // 既定額 × 1.1
    repo.setPeriodFixedAmount(db, '2026-08', water, 2900);
    repo.startPeriod(db, '2026-09', base('2026-09-25'));
    repo.setPeriodFixedAmount(db, '2026-09', water, 0); // 請求なしの月
    repo.startPeriod(db, '2026-10', base('2026-10-23'));
    expect(repo.listPeriodFixedCosts(db, '2026-10')[0].amount).toBe(Math.round(2900 * 1.1));
  });

  it('saves, filters and deletes transactions; purposes sorted by usage', async () => {
    const db = await openDb(null);
    const cash = repo.listWallets(db).find((w) => w.name === '現金')!.id;
    const pid = repo.findOrCreatePurpose(db, 'ラーメン', 'food');
    const id = repo.saveTransaction(db, { date: '2026-10-24', wallet_id: cash, category_code: 'food', purpose_id: pid, amount: 900, memo: null });
    repo.saveTransaction(db, { date: '2026-11-30', wallet_id: cash, category_code: 'fun', purpose_id: null, amount: 100, memo: 'x' });
    const r = repo.periodRange(db, '2026-10');
    expect(repo.listTransactions(db, { from: r.start, to: r.end })).toHaveLength(1);
    expect(repo.listTransactions(db, { text: 'ラーメン' })[0].purpose_name).toBe('ラーメン');
    expect(repo.listPurposes(db, { walletId: cash })[0].name).toBe('ラーメン');
    repo.deleteTransaction(db, id);
    expect(repo.listTransactions(db)).toHaveLength(1);
  });

  it('computes past totals for recommendations', async () => {
    const db = await openDb(null);
    const cash = repo.listWallets(db)[2].id;
    repo.savePeriod(db, '2026-09', base('2026-09-25'));
    repo.saveTransaction(db, { date: '2026-10-01', wallet_id: cash, category_code: 'food', purpose_id: null, amount: 40000, memo: null });
    repo.saveTransaction(db, { date: '2026-10-02', wallet_id: cash, category_code: 'transport', purpose_id: null, amount: 1000, memo: null });
    const past = repo.pastPeriodTotals(db, '2026-10');
    expect(past).toHaveLength(1);
    expect(past[0]).toMatchObject({ food: 40000, transport: 1000 });
  });
});
