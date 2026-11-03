import { addDays, diffDays, toISO, type ISODate, parseYM, type YM } from './date';
import { isHoliday } from './holidays';

export interface PaydayRule {
  /** 給料日 (日) */
  day: number;
  /** 祝日も前倒しするか */
  holidays: boolean;
}

export const DEFAULT_RULE: PaydayRule = { day: 25, holidays: true };

/**
 * 給料日: 指定日が土日 (と祝日) なら前の営業日へ前倒し。
 * Excel の「土曜→24日、日曜→23日」を一般化したもの。
 */
export function paydayOf(key: YM, rule: PaydayRule = DEFAULT_RULE): ISODate {
  const { year, month } = parseYM(key);
  const last = new Date(year, month, 0).getDate();
  const d = new Date(year, month - 1, Math.min(rule.day, last));
  while (d.getDay() === 0 || d.getDay() === 6 || (rule.holidays && isHoliday(d))) {
    d.setDate(d.getDate() - 1);
  }
  return toISO(d);
}

export interface PeriodRange {
  ym: YM;
  start: ISODate;
  /** 最終日 (次の期間の開始日の前日) */
  end: ISODate;
  days: number;
}

export function makeRange(key: YM, start: ISODate, nextStart: ISODate): PeriodRange {
  return { ym: key, start, end: addDays(nextStart, -1), days: diffDays(start, nextStart) };
}

/** 今日が何日目か (期間外なら 0 または days) */
export function elapsedDays(p: PeriodRange, today: ISODate): number {
  return Math.min(p.days, Math.max(0, diffDays(p.start, today) + 1));
}

export const yen = (n: number) => `${n < 0 ? '−' : ''}¥${Math.abs(Math.round(n)).toLocaleString('ja-JP')}`;
