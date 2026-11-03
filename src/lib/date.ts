/** 日付は DB 上 'YYYY-MM-DD' 文字列で扱う (タイムゾーンの影響を避ける) */
export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

export const todayISO = () => toISO(new Date());

/** 'M/DD' 表示 */
export function fmtMD(s: ISODate): string {
  const d = fromISO(s);
  return `${d.getMonth() + 1}/${pad(d.getDate())}`;
}

const WD = ['日', '月', '火', '水', '木', '金', '土'];
export function fmtMDW(s: ISODate): string {
  return `${fmtMD(s)} (${WD[fromISO(s).getDay()]})`;
}

/** 年月キー 'YYYY-MM' */
export type YM = string;
export const ym = (year: number, month1: number) => `${year}-${pad(month1)}`;
export function parseYM(k: YM): { year: number; month: number } {
  const [year, month] = k.split('-').map(Number);
  return { year, month };
}
export function shiftYM(k: YM, n: number): YM {
  const { year, month } = parseYM(k);
  const d = new Date(year, month - 1 + n, 1);
  return ym(d.getFullYear(), d.getMonth() + 1);
}
export function fmtYM(k: YM): string {
  const { year, month } = parseYM(k);
  return `${year}年${month}月`;
}
