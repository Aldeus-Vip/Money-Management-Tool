import { describe, expect, it } from 'vitest';
import { isHoliday } from '../src/lib/holidays';
import { paydayOf } from '../src/lib/period';
import { evalAmount, recommend, summarize, withdrawDate } from '../src/lib/budget';
import type { Period, Transaction } from '../src/db/repo';

describe('holidays', () => {
  it('fixed, happy-monday, equinox, substitute', () => {
    expect(isHoliday(new Date(2026, 0, 1))).toBe(true);
    expect(isHoliday(new Date(2026, 0, 12))).toBe(true); // 成人の日 (2nd Mon)
    expect(isHoliday(new Date(2026, 2, 20))).toBe(true); // 春分の日
    expect(isHoliday(new Date(2026, 8, 22))).toBe(true); // 国民の休日 (敬老の日と秋分の日の間)
    expect(isHoliday(new Date(2026, 4, 6))).toBe(true); // 振替休日 (5/3 が日曜)
    expect(isHoliday(new Date(2026, 9, 26))).toBe(false);
  });
});

describe('payday', () => {
  const weekendOnly = { day: 25, holidays: false };
  it('matches the Excel rule (Sat→24, Sun→23)', () => {
    expect(paydayOf('2026-10', weekendOnly)).toBe('2026-10-23'); // 10/25 = Sun
    expect(paydayOf('2026-11', weekendOnly)).toBe('2026-11-25'); // Wed
    expect(paydayOf('2026-04', weekendOnly)).toBe('2026-04-24'); // 4/25 = Sat
  });
  it('moves earlier on holidays when enabled', () => {
    // 2027-12-25 は土曜 → 24日 (金, 平日)
    expect(paydayOf('2027-12', { day: 25, holidays: true })).toBe('2027-12-24');
    // 給料日 23日設定で 2026-11-23 (勤労感謝の日・月) → 11/20 (金)
    expect(paydayOf('2026-11', { day: 23, holidays: true })).toBe('2026-11-20');
    expect(paydayOf('2026-11', { day: 23, holidays: false })).toBe('2026-11-23');
  });
});

const period = (o: Partial<Period> = {}): Period => ({
  ym: '2026-10', start_date: '2026-10-23', salary: 250000, bonus: 100000, bonus_on: 0, food_budget: 50000,
  charge_limit: 3000, fun_limit: 8000, saving_move: 10000, fun_move: 5000, extra_add: 0, memo: null, ...o,
});
const t = (category_code: Transaction['category_code'], amount: number, is_charge = 0, date = '2026-10-24'): Transaction => ({
  id: 0, date, wallet_id: 1, wallet_name: '', category_code, category_name: '', purpose_id: null, purpose_name: null, is_charge, amount, memo: null,
});

describe('summarize (目的設定シート)', () => {
  it('computes free frame and remaining like the Excel formulas', () => {
    const s = summarize(period(), [t('food', 2000), t('fun', 1200, 1), t('fun', 700), t('transport', 400), t('extra', 3000), t('other', 100), t('income', 1000)], 140000);
    expect(s.afterFixed).toBe(110000); // D24
    expect(s.freeFrame).toBe(60000); // D28
    expect(s.freeTotal).toBe(61000); // K7 (+受取金)
    expect(s.afterLimits).toBe(50000); // K14
    expect(s.extraBudget).toBe(35000); // K20
    expect(s.chargeUsed).toBe(1200);
    expect(s.funOtherUsed).toBe(700);
    expect(s.extraUsed).toBe(3500); // K26
    expect(s.freeRemain).toBe(61000 - 1200 - 700 - 3500 - 15000); // K28
  });
  it('adds bonus only when enabled', () => {
    expect(summarize(period({ bonus_on: 1 }), [], 0).income).toBe(350000);
  });
});

describe('helpers', () => {
  it('recommend', () => {
    const r = { food: 0, transport: 0, fun: 0, extra: 0, other: 0, income: 0 };
    expect(recommend([], 1.05, 5000)).toEqual({ food: null, extra: null });
    expect(recommend([{ ...r, food: 40000, extra: 10000 }, { ...r, food: 60000, transport: 2000 }], 1.05, 5000)).toEqual({ food: 52500, extra: 11300 });
  });
  it('withdrawDate picks the date inside the period', () => {
    const range = { ym: '2026-10', start: '2026-10-23', end: '2026-11-24', days: 33 };
    expect(withdrawDate(range, 27)).toBe('2026-10-27');
    expect(withdrawDate(range, 5)).toBe('2026-11-05');
    expect(withdrawDate(range, 31)).toBe('2026-10-31');
    expect(withdrawDate(range, null)).toBeNull();
  });
  it('evalAmount', () => {
    expect(evalAmount('1009+1133+1334')).toBe(3476);
    expect(evalAmount('¥1,200')).toBe(1200);
    expect(evalAmount('１５００')).toBe(1500);
    expect(evalAmount('abc')).toBeNull();
  });
});

import { hashPin, isValidPin, verifyPin } from '../src/lib/pin';
describe('pin', () => {
  it('hashes and verifies', async () => {
    const { hash, salt } = await hashPin('1234');
    expect(await verifyPin('1234', hash, salt)).toBe(true);
    expect(await verifyPin('1235', hash, salt)).toBe(false);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12345678')).toBe(true);
  });
});

describe('evalAmount (掛け算・括弧)', () => {
  it('supports × ÷ and parentheses', async () => {
    const { evalAmount, isExpression } = await import('../src/lib/budget');
    expect(evalAmount('400*5')).toBe(2000);
    expect(evalAmount('400×5')).toBe(2000);
    expect(evalAmount('(1200+800)×2')).toBe(4000);
    expect(evalAmount('1009+1133+1334')).toBe(3476);
    expect(evalAmount('3000÷3')).toBe(1000);
    expect(evalAmount('1000/3')).toBe(333);
    expect(evalAmount('-500')).toBe(-500);
    expect(evalAmount('＝１２０＋８０')).toBe(200);
    expect(evalAmount('(1+2')).toBeNull();
    expect(evalAmount('1++')).toBeNull();
    expect(isExpression('400*5')).toBe(true);
    expect(isExpression('-500')).toBe(false);
    expect(isExpression('2,967')).toBe(false);
  });
});

describe('budgetTone', () => {
  it('danger only when remaining is negative', async () => {
    const { budgetTone } = await import('../src/lib/budget');
    expect(budgetTone(6505, 6505).text).toBe('使い切り');
    expect(budgetTone(6506, 6505).tone).toBe('danger');
    expect(budgetTone(900, 1000).text).toBe('残りわずか');
    expect(budgetTone(500, 1000, 0.3).text).toBe('ペース超過');
    expect(budgetTone(100, 1000, 0.3).text).toBe('順調');
    expect(budgetTone(0, 0).tone).toBe('ok');
  });
});
