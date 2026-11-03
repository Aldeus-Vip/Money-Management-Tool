/**
 * デザインモック用の **架空データ**。実データとは無関係。
 * 個人データはリポジトリに置かない方針 (docs/03_decisions.md)。
 */
export type Category = '食費' | '交通費' | '娯楽費' | '臨時費用' | 'その他';

export const CATEGORY_COLOR: Record<Category, string> = {
  食費: 'var(--c-cyan)',
  交通費: 'var(--c-blue)',
  娯楽費: 'var(--c-violet)',
  臨時費用: 'var(--c-amber)',
  その他: 'var(--c-silver-dim)',
};

export const sample = {
  salary: 250_000,
  bonus: 0,
  fixedTotal: 140_000,
  foodBudget: 50_000,
  /** 自由枠 = 給料 + 賞与 − 固定費 − 食費予算 */
  get freeFrame() {
    return this.salary + this.bonus - this.fixedTotal - this.foodBudget;
  },
  freeUsed: 21_800,

  budgets: [
    { key: 'food', label: '食費', used: 19_800, limit: 50_000, paced: true },
    { key: 'extra', label: '臨時費用', used: 9_200, limit: 34_000, paced: true },
    { key: 'charge', label: '課金', used: 1_200, limit: 3_000, paced: false },
    { key: 'fun', label: '娯楽費その他', used: 7_400, limit: 8_000, paced: false },
  ],

  wallets: [
    { name: '普通口座', calc: 82_340, note: '未引落の固定費を控除後' },
    { name: '現金', calc: 6_420, actual: 6_300 },
    { name: 'PayPay', calc: 3_150 },
    { name: 'Suica', calc: 1_280 },
  ],

  pools: [
    { name: '貯金', balance: 120_000, moved: 10_000 },
    { name: '娯楽費', balance: 18_500, moved: 5_000 },
  ],

  upcomingFixed: [
    { date: '11/05', name: '携帯代', amount: 6_800 },
    { date: '11/07', name: 'ソフトウェア', amount: 2_100 },
    { date: '11/10', name: '電気代', amount: 11_500 },
    { date: '11/16', name: 'ガス代', amount: 2_700 },
    { date: '11/20', name: '動画配信', amount: 1_500 },
  ],
  fixedPaid: 5,
  fixedCount: 10,

  /** 期間初日からの日別支出 (区分別) */
  daily: [
    { 食費: 1800, 交通費: 0, 娯楽費: 0, 臨時費用: 0, その他: 0 },
    { 食費: 1500, 交通費: 420, 娯楽費: 0, 臨時費用: 0, その他: 0 },
    { 食費: 2200, 交通費: 0, 娯楽費: 1200, 臨時費用: 0, その他: 0 },
    { 食費: 900, 交通費: 0, 娯楽費: 0, 臨時費用: 3500, その他: 0 },
    { 食費: 1300, 交通費: 0, 娯楽費: 0, 臨時費用: 0, その他: 300 },
    { 食費: 2400, 交通費: 840, 娯楽費: 2800, 臨時費用: 0, その他: 0 },
    { 食費: 1100, 交通費: 0, 娯楽費: 0, 臨時費用: 0, その他: 0 },
    { 食費: 1700, 交通費: 0, 娯楽費: 0, 臨時費用: 2400, その他: 0 },
    { 食費: 2100, 交通費: 420, 娯楽費: 1500, 臨時費用: 0, その他: 0 },
    { 食費: 1600, 交通費: 0, 娯楽費: 0, 臨時費用: 0, その他: 0 },
    { 食費: 1500, 交通費: 0, 娯楽費: 1900, 臨時費用: 3300, その他: 0 },
    { 食費: 1700, 交通費: 260, 娯楽費: 0, 臨時費用: 0, その他: 0 },
  ] as Record<Category, number>[],
};
