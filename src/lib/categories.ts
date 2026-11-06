import type { CategoryCode } from '../db/repo';

export const EXPENSE_CODES: Exclude<CategoryCode, 'income'>[] = ['food', 'transport', 'fun', 'extra', 'other'];

export const CATEGORY_LABEL: Record<CategoryCode, string> = {
  food: '食費', transport: '交通費', fun: '娯楽費', extra: '臨時費用', other: 'その他', income: '受取金',
};

/** 区分の色 (予算枠の色と揃える: 食費 = 緑 / 娯楽費 = 青灰 / 臨時費用 = 黄) */
export const CATEGORY_COLOR: Record<CategoryCode, string> = {
  food: '#86D27E',
  transport: '#5BA4E6',
  fun: '#9FB0E0',
  extra: '#F5C84B',
  other: '#8A96A3',
  income: '#19E3E8',
};
