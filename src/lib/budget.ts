import type { CategoryCode, Period, Transaction } from '../db/repo';
import { diffDays, type ISODate } from './date';
import type { PeriodRange } from './period';

/**
 * Excel「目的設定」シートの計算を移植したもの。
 * セル対応はコメントに記載 (例: D24 = 目的設定!D24)。
 */
export interface BudgetSummary {
  income: number;            // 給料 + 賞与(ON時)
  fixedTotal: number;        // 固定費合計              SUM(D7:D22)
  afterFixed: number;        // 固定費支払後残高        D24
  freeFrame: number;         // 自由枠                  D28 = D24 − 食費予算
  received: number;          // 受取金                  (K4 の一部)
  freeTotal: number;         // 自由枠合計              K7 (繰越は保留 → extra_add で暫定加算)
  afterLimits: number;       // 課金・娯楽枠を除いた残り K14
  extraBudget: number;       // 臨時費用枠              K20
  foodUsed: number;
  chargeUsed: number;        // 課金使用額              K23
  funOtherUsed: number;      // 娯楽費その他使用額      K24
  extraUsed: number;         // 臨時費用使用額          K26 = 交通費 + 臨時費用 + その他
  freeRemain: number;        // 自由枠残り              K28
  byCategory: Record<CategoryCode, number>;
}

export const emptyByCategory = (): Record<CategoryCode, number> => ({ food: 0, transport: 0, fun: 0, extra: 0, other: 0, income: 0 });

export function summarize(p: Period, txs: Transaction[], fixedTotal: number): BudgetSummary {
  const by = emptyByCategory();
  let charge = 0;
  for (const t of txs) {
    by[t.category_code] += t.amount;
    if (t.category_code === 'fun' && t.is_charge) charge += t.amount;
  }
  const income = p.salary + (p.bonus_on ? p.bonus : 0);
  const afterFixed = income - fixedTotal;
  const freeFrame = afterFixed - p.food_budget;
  const received = by.income;
  const freeTotal = freeFrame + received + p.extra_add;
  const afterLimits = freeTotal - p.charge_limit - p.fun_limit;
  const extraBudget = afterLimits - p.saving_move - p.fun_move;
  const funOtherUsed = by.fun - charge;
  const extraUsed = by.transport + by.extra + by.other;
  return {
    income,
    fixedTotal,
    afterFixed,
    freeFrame,
    received,
    freeTotal,
    afterLimits,
    extraBudget,
    foodUsed: by.food,
    chargeUsed: charge,
    funOtherUsed,
    extraUsed,
    freeRemain: freeTotal - charge - funOtherUsed - extraUsed - p.saving_move - p.fun_move,
    byCategory: by,
  };
}

/** 推奨値: 食費 = 過去平均 × 1.05 / 臨時費用 = 過去(交通費+臨時費用+その他)平均 × 1.05 + 最低額 */
export function recommend(past: Record<CategoryCode, number>[], avgRate: number, extraMin: number) {
  if (past.length === 0) return { food: null, extra: null };
  const avg = (f: (r: Record<CategoryCode, number>) => number) => past.reduce((s, r) => s + f(r), 0) / past.length;
  return {
    food: Math.round(avg((r) => r.food) * avgRate),
    extra: Math.round(avg((r) => r.transport + r.extra + r.other) * avgRate + extraMin),
  };
}

/** 日別 × 区分の支出 (受取金を除く)。index 0 = 期間初日 */
export function dailyByCategory(range: PeriodRange, txs: Transaction[]): Record<CategoryCode, number>[] {
  const days = Array.from({ length: range.days }, emptyByCategory);
  for (const t of txs) {
    const i = diffDays(range.start, t.date);
    if (i >= 0 && i < range.days && t.category_code !== 'income') days[i][t.category_code] += t.amount;
  }
  return days;
}

/** 固定費の引落日 (期間内の該当日) */
export function withdrawDate(range: PeriodRange, day: number | null): ISODate | null {
  if (!day) return null;
  const [sy, sm] = range.start.split('-').map(Number);
  for (const offset of [0, 1]) {
    const d = new Date(sy, sm - 1 + offset, 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (iso >= range.start && iso <= range.end) return iso;
  }
  return null;
}

/** "1009+1133-200" のような簡易式を評価 (Excel で =1009+1133 と入力していた運用の再現) */
export function evalAmount(input: string): number | null {
  const s = input.replace(/[,\s¥円]/g, '').replace(/[＋]/g, '+').replace(/[－ー−]/g, '-')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (!/^[+-]?\d+([+-]\d+)*$/.test(s)) return null;
  return s.match(/[+-]?\d+/g)!.reduce((a, b) => a + Number(b), 0);
}
