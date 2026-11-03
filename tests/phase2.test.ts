import { describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { openDb } from '../src/db/sqlite';
import { MIGRATIONS, SCHEMA_VERSION } from '../src/db/schema';
import * as repo from '../src/db/repo';
import { loadPeriod } from '../src/state/loadPeriod';
import { carryCandidates } from '../src/lib/balances';
import { periodItems } from '../src/lib/actuals';

const base = (start: string, o: Partial<repo.PeriodInput> = {}): repo.PeriodInput => ({
  start_date: start, salary: 250000, bonus: 0, bonus_on: 0, food_budget: 50000,
  charge_limit: 3000, fun_limit: 8000, saving_move: 10000, fun_move: 5000, extra_add: 0, ...o,
});

async function setup() {
  const db = await openDb(null);
  const w = Object.fromEntries(repo.listWallets(db).map((x) => [x.name, x.id]));
  repo.saveFixedCost(db, { name: '家賃', withdraw_day: 27, cycle_months: 1, buffer: 0, default_amount: 60000, active: 1, mode: 'fixed' });
  repo.saveFixedCost(db, { name: '携帯', withdraw_day: 5, cycle_months: 1, buffer: 0, default_amount: 7000, active: 1, mode: 'fixed' });
  repo.startPeriod(db, '2026-10', base('2026-10-23'));
  return { db, w };
}

describe('migration', () => {
  it('upgrades an existing v1 database to the latest version without losing data', async () => {
    const SQL = await initSqlJs();
    const v1 = new SQL.Database();
    v1.exec(MIGRATIONS[0]);
    v1.run('PRAGMA user_version = 1');
    v1.run("INSERT INTO transactions (date, wallet_id, category_code, amount, created_at, updated_at) VALUES ('2026-10-24', 3, 'food', 500, 'x', 'x')");
    const db = await openDb(v1.export());
    expect(Number(db.exec('PRAGMA user_version')[0].values[0][0])).toBe(SCHEMA_VERSION);
    expect(repo.listTransactions(db)).toHaveLength(1);
    expect(repo.listPools(db).map((p) => p.name)).toEqual(['貯金', '娯楽費']);
  });
});

describe('balances (銀行口座・現金シート)', () => {
  it('computes bank / cash / PayPay balances and unknown money', async () => {
    const { db, w } = await setup();
    repo.setOpening(db, '2026-10', w['普通口座'], 20000);
    repo.setOpening(db, '2026-10', w['現金'], 3000);
    repo.setFixedPaid(db, '2026-10', repo.listPeriodFixedCosts(db, '2026-10').find((f) => f.name === '家賃')!.fixed_cost_id, true);
    repo.saveTransfer(db, { date: '2026-10-24', from_wallet_id: w['普通口座'], to_wallet_id: w['現金'], amount: 10000, fee: 110 });
    repo.saveTransfer(db, { date: '2026-10-25', from_wallet_id: w['普通口座'], to_wallet_id: w['PayPay'], amount: 5000 });
    const tx = (wallet: number, category: repo.CategoryCode, amount: number) =>
      repo.saveTransaction(db, { date: '2026-10-26', wallet_id: wallet, category_code: category, purpose_id: null, amount, memo: null });
    tx(w['デビット'], 'food', 2000);
    tx(w['現金'], 'food', 1500);
    tx(w['PayPay'], 'fun', 800);
    tx(w['普通口座'], 'income', 3000); // 振込
    repo.savePoolEntry(db, { pool_id: repo.listPools(db)[0].id, date: '2026-10-27', kind: 'use', amount: 4000, purpose: '臨時費用補填' });
    repo.setActual(db, '2026-10', w['現金'], 11000);

    const d = loadPeriod(db, '2026-10');
    const get = (name: string) => d.balances.find((b) => b.wallet.name === name)!;
    // 20000 + 250000 − 60000(家賃済) − 15000(移動) + 4000(プール) − 15000(出金・チャージ) − 110(手数料) − 2000(デビット) + 3000(振込)
    expect(get('普通口座').current).toBe(184890);
    expect(get('普通口座').projected).toBe(184890 - 7000);
    expect(get('現金').current).toBe(3000 + 10000 - 1500);
    expect(get('現金').unknown).toBe(500);
    expect(get('PayPay').current).toBe(4200);
    expect(get('デビット').merged).toBe(true);
    // 手数料はその他 → 臨時費用の使用額に入る (Excel K26)
    expect(d.summary!.extraUsed).toBe(110);
    expect(d.summary!.poolUse).toBe(4000);
    expect(d.summary!.freeTotal).toBe(250000 - 67000 - 50000 + 3000 + 4000);

    const cand = carryCandidates(d.balances);
    expect(cand.get(w['現金'])).toBe(11000); // 実残高を優先
    expect(cand.get(w['普通口座'])).toBe(184890);
  });

  it('adds opening balances to the free frame only when carry_opening is on', async () => {
    const { db, w } = await setup();
    repo.setOpening(db, '2026-10', w['普通口座'], 20000);
    repo.setOpening(db, '2026-10', w['現金'], 3000);
    const off = loadPeriod(db, '2026-10').summary!.freeTotal;
    repo.setSetting(db, 'carry_opening', '1');
    expect(loadPeriod(db, '2026-10').summary!.freeTotal).toBe(off + 23000);
  });

  it('deleting a transfer removes its fee transaction', async () => {
    const { db, w } = await setup();
    const id = repo.saveTransfer(db, { date: '2026-10-24', from_wallet_id: w['普通口座'], to_wallet_id: w['現金'], amount: 10000, fee: 220 });
    expect(repo.listTransfers(db)[0].fee).toBe(220);
    repo.deleteTransfer(db, id);
    expect(repo.listTransactions(db)).toHaveLength(0);
  });
});

describe('pools', () => {
  it('balance = adjustments + period moves − uses', async () => {
    const { db } = await setup();
    const saving = repo.listPools(db)[0];
    repo.savePoolEntry(db, { pool_id: saving.id, date: '2026-10-01', kind: 'adjust', amount: 100000 });
    repo.savePoolEntry(db, { pool_id: saving.id, date: '2026-10-30', kind: 'use', amount: 3000 });
    repo.startPeriod(db, '2026-11', base('2026-11-25', { saving_move: 20000 }));
    const oct = repo.poolStatus(db, '2026-10').find((p) => p.code === 'saving')!;
    expect(oct).toMatchObject({ balance: 107000, moved: 10000, used: 3000 });
    expect(repo.poolStatus(db, '2026-11').find((p) => p.code === 'saving')!.balance).toBe(127000);
  });
});

describe('import batches', () => {
  it('deletes only rows from the batch', async () => {
    const { db, w } = await setup();
    const b = repo.createBatch(db, '2025_10_MoneyManagementSheet.xlsm');
    repo.saveTransaction(db, { date: '2026-10-24', wallet_id: w['現金'], category_code: 'food', purpose_id: null, amount: 100, memo: null });
    db.run("INSERT INTO transactions (date, wallet_id, category_code, amount, created_at, updated_at, batch_id) VALUES ('2025-10-26', 3, 'food', 900, 'x', 'x', ?)", [b]);
    db.run("INSERT INTO monthly_actuals (ym, item, amount, batch_id) VALUES ('2025-10', 'cat:food', 62000, ?)", [b]);
    expect(repo.listBatches(db)[0].rows).toBe(2);
    repo.deleteBatch(db, b);
    expect(repo.listTransactions(db)).toHaveLength(1);
    expect(repo.listMonthlyActuals(db, '2025-01', '2025-12')).toHaveLength(0);
    expect(repo.listBatches(db)).toHaveLength(0);
  });

  it('periodItems produces actuals rows with the same keys as monthly_actuals', async () => {
    const { db } = await setup();
    const m = periodItems(loadPeriod(db, '2026-10'));
    expect(m.get('fixed:家賃')).toBe(60000);
    expect(m.get('fixed:total')).toBe(67000);
    expect(m.get('income:salary')).toBe(250000);
    expect(m.get('move:saving')).toBe(10000);
  });
});

describe('fixed costs: budget uses planned, bank uses actual', () => {
  it('separates planned (budget) and actual (bank)', async () => {
    const { db, w } = await setup();
    const rent = repo.listPeriodFixedCosts(db, '2026-10').find((f) => f.name === '家賃')!.fixed_cost_id;
    repo.setOpening(db, '2026-10', w['普通口座'], 0);
    repo.setPlanned(db, '2026-10', rent, 61000);
    repo.setActualFixed(db, '2026-10', rent, 59000);
    repo.setFixedPaid(db, '2026-10', rent, true);
    const d = loadPeriod(db, '2026-10');
    expect(d.fixedTotal).toBe(61000 + 7000); // 予算額
    expect(d.balances.find((b) => b.wallet.name === '普通口座')!.fixedPaid).toBe(59000); // 引落額
    expect(periodItems(d).get('fixed:家賃')).toBe(59000); // 実績 = 引落額
  });
});

describe('migration v2 → v3 keeps entered fixed amounts as manual', () => {
  it('copies amount into planned/actual', async () => {
    const SQL = await initSqlJs();
    const v2 = new SQL.Database();
    v2.exec(MIGRATIONS[0]); v2.exec(MIGRATIONS[1]);
    v2.run('PRAGMA user_version = 2');
    v2.run("INSERT INTO fixed_costs (name, default_amount, buffer) VALUES ('電気', 9000, 1)");
    v2.run("INSERT INTO periods (ym, start_date) VALUES ('2026-10', '2026-10-23')");
    v2.run("INSERT INTO period_fixed_costs (ym, fixed_cost_id, amount) VALUES ('2026-10', 1, 8800)");
    const db = await openDb(v2.export());
    expect(repo.listPeriodFixedCosts(db, '2026-10')[0]).toMatchObject({ planned_input: 8800, actual_input: 8800, mode: 'average' });
  });
});

import { buildLedger } from '../src/lib/ledger';
describe('ledger (通帳形式)', () => {
  it('running balance ends at the computed current balance for every wallet', async () => {
    const { db, w } = await setup();
    repo.setOpening(db, '2026-10', w['普通口座'], 20000);
    repo.setOpening(db, '2026-10', w['現金'], 3000);
    repo.setFixedPaid(db, '2026-10', repo.listPeriodFixedCosts(db, '2026-10')[0].fixed_cost_id, true);
    repo.saveTransfer(db, { date: '2026-10-24', from_wallet_id: w['普通口座'], to_wallet_id: w['現金'], amount: 10000, fee: 110 });
    repo.saveTransaction(db, { date: '2026-10-25', wallet_id: w['デビット'], category_code: 'food', purpose_id: null, amount: 2000, memo: null });
    repo.saveTransaction(db, { date: '2026-10-26', wallet_id: w['現金'], category_code: 'food', purpose_id: null, amount: 1500, memo: null });
    repo.saveTransaction(db, { date: '2026-10-26', wallet_id: w['普通口座'], category_code: 'income', purpose_id: null, amount: 3000, memo: null });
    repo.savePoolEntry(db, { pool_id: repo.listPools(db)[0].id, date: '2026-10-27', kind: 'use', amount: 4000 });
    const d = loadPeriod(db, '2026-10');
    for (const b of d.balances.filter((x) => !x.merged)) {
      const l = buildLedger(d, b.wallet.id);
      expect(l[l.length - 1].balance).toBe(b.current);
    }
    // デビットを選ぶと口座の明細
    expect(buildLedger(d, w['デビット']).some((r) => r.sub?.includes('デビット'))).toBe(true);
    expect(buildLedger(d, w['現金']).map((r) => r.balance)).toEqual([3000, 13000, 11500]);
  });
});
