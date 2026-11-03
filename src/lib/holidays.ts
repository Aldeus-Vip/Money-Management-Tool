/**
 * 日本の祝日 (2020年以降の祝日法に準拠、2099年まで)。
 * 振替休日・国民の休日を含む。特例 (オリンピック等の移動) は対象外。
 */
const cache = new Map<number, Set<string>>();

const key = (m: number, d: number) => `${m}-${d}`;

function nthMonday(year: number, month: number, n: number): number {
  const first = new Date(year, month - 1, 1).getDay();
  const offset = (8 - first) % 7; // 最初の月曜までの日数
  return 1 + offset + (n - 1) * 7;
}

function springEquinox(y: number): number {
  return Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
}
function autumnEquinox(y: number): number {
  return Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
}

function build(year: number): Set<string> {
  const base: [number, number][] = [
    [1, 1],
    [1, nthMonday(year, 1, 2)],
    [2, 11],
    [2, 23],
    [3, springEquinox(year)],
    [4, 29],
    [5, 3],
    [5, 4],
    [5, 5],
    [7, nthMonday(year, 7, 3)],
    [8, 11],
    [9, nthMonday(year, 9, 3)],
    [9, autumnEquinox(year)],
    [10, nthMonday(year, 10, 2)],
    [11, 3],
    [11, 23],
  ];
  const set = new Set(base.map(([m, d]) => key(m, d)));

  // 国民の休日: 祝日に挟まれた平日
  for (const [m, d] of base) {
    const next = new Date(year, m - 1, d + 2);
    const mid = new Date(year, m - 1, d + 1);
    if (set.has(key(next.getMonth() + 1, next.getDate())) && mid.getDay() !== 0 && !set.has(key(mid.getMonth() + 1, mid.getDate()))) {
      set.add(key(mid.getMonth() + 1, mid.getDate()));
    }
  }
  // 振替休日: 日曜の祝日 → 次の祝日でない日
  for (const [m, d] of base) {
    const dt = new Date(year, m - 1, d);
    if (dt.getDay() !== 0) continue;
    const sub = new Date(dt);
    do sub.setDate(sub.getDate() + 1);
    while (set.has(key(sub.getMonth() + 1, sub.getDate())));
    if (sub.getFullYear() === year) set.add(key(sub.getMonth() + 1, sub.getDate()));
  }
  return set;
}

export function isHoliday(d: Date): boolean {
  const y = d.getFullYear();
  let s = cache.get(y);
  if (!s) cache.set(y, (s = build(y)));
  return s.has(key(d.getMonth() + 1, d.getDate()));
}
