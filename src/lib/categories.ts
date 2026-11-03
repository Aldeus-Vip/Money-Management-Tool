import type { CategoryCode } from '../db/repo';

export const EXPENSE_CODES: Exclude<CategoryCode, 'income'>[] = ['food', 'transport', 'fun', 'extra', 'other'];

export const CATEGORY_LABEL: Record<CategoryCode, string> = {
  food: '食費', transport: '交通費', fun: '娯楽費', extra: '臨時費用', other: 'その他', income: '受取金',
};

export const CATEGORY_COLOR: Record<CategoryCode, string> = {
  food: 'var(--c-cyan)',
  transport: 'var(--c-blue)',
  fun: 'var(--c-violet)',
  extra: 'var(--c-amber)',
  other: 'var(--c-silver-dim)',
  income: 'var(--c-green)',
};
