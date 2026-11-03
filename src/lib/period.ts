/**
 * 給料日起点の「期間」計算。
 * Excel の数式を移植: 25日が土曜→24日、日曜→23日 に前倒し。
 * (祝日の前倒しは Phase 1 で追加予定)
 */
export const PAYDAY = 25;

export function paydayOf(year: number, month0: number): Date {
  const d = new Date(year, month0, PAYDAY);
  const wd = d.getDay();
  if (wd === 6) d.setDate(PAYDAY - 1);
  if (wd === 0) d.setDate(PAYDAY - 2);
  return d;
}

export interface Period {
  /** 給料日 (期間の初日) */
  start: Date;
  /** 次の給料日の前日 (期間の最終日) */
  end: Date;
  days: number;
}

export function periodOf(year: number, month0: number): Period {
  const start = paydayOf(year, month0);
  const next = paydayOf(year, month0 + 1);
  const end = new Date(next);
  end.setDate(end.getDate() - 1);
  const days = Math.round((next.getTime() - start.getTime()) / 86_400_000);
  return { start, end, days };
}

export function elapsedDays(p: Period, today: Date): number {
  const ms = today.getTime() - p.start.getTime();
  return Math.min(p.days, Math.max(0, Math.floor(ms / 86_400_000) + 1));
}

export const fmtDate = (d: Date) =>
  `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`;

export const yen = (n: number) =>
  `${n < 0 ? '−' : ''}¥${Math.abs(Math.round(n)).toLocaleString('ja-JP')}`;
