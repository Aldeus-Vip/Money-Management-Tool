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

  it('fixed costs: fixed amount vs past average × buffer, manual override and reset to master', async () => {
    const db = await openDb(null);
    const rent = repo.saveFixedCost(db, { name: '家賃', withdraw_day: 27, cycle_months: 1, buffer: 0, default_amount: 50000, active: 1, mode: 'fixed' });
    const water = repo.saveFixedCost(db, { name: '水道', withdraw_day: 28, cycle_months: 2, buffer: 1, default_amount: 3000, active: 1, mode: 'average' });
    repo.startPeriod(db, '2026-08', base('2026-08-25'));
    const row = (ym: string, id: number) => repo.listPeriodFixedCosts(db, ym).find((f) => f.fixed_cost_id === id)!;
    // 実績が無い → マスタの金額 (× バッファ)
    expect(row('2026-08', water)).toMatchObject({ planned_input: null, actual_input: null, auto: 3300, planned: 3300, actual: 3300 });
    expect(row('2026-08', rent).auto).toBe(50000);
    // 引落額を手入力 → 過去平均に使われる / 予算額は自動のまま
    repo.setActualFixed(db, '2026-08', water, 2900);
    expect(row('2026-08', water)).toMatchObject({ actual_input: 2900, actual: 2900, planned: 3300 });
    repo.startPeriod(db, '2026-09', base('2026-09-25'));
    repo.setActualFixed(db, '2026-09', water, 0); // 請求なしの月
    repo.startPeriod(db, '2026-10', base('2026-10-23'));
    expect(row('2026-10', water).auto).toBe(Math.round(2900 * 1.1));
    // 予算額を手入力 → マスタに戻す
    repo.setPlanned(db, '2026-10', rent, 52000);
    expect(row('2026-10', rent)).toMatchObject({ planned: 52000, actual: 50000 });
    repo.setPlanned(db, '2026-10', rent, null);
    expect(row('2026-10', rent).planned).toBe(50000);
    // マスタの金額を変えると、自動の行はすべて追従する
    repo.saveFixedCost(db, { id: rent, name: '家賃', withdraw_day: 27, cycle_months: 1, buffer: 0, default_amount: 55000, active: 1, mode: 'fixed' });
    expect(row('2026-10', rent).planned).toBe(55000);
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
