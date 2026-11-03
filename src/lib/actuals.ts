import type { PeriodData } from '../state/loadPeriod';

/**
 * 費用実績 (Excel「費用実績」シート) の行キー。
 * monthly_actuals.item と同じキーを使うので、集計値だけの月 (Excel 取り込み) とも混在できる。
 */
export const ITEM_GROUPS: { title: string; items: { key: string; label: string }[] }[] = [
  { title: '収入', items: [{ key: 'income:salary', label: '給料' }, { key: 'income:bonus', label: '賞与' }, { key: 'income:received', label: '受取金' }] },
  { title: '変動費', items: [
    { key: 'cat:food', label: '食費' }, { key: 'cat:transport', label: '交通費' }, { key: 'cat:fun', label: '娯楽費' },
    { key: 'cat:extra', label: '臨時費用' }, { key: 'cat:other', label: 'その他' }, { key: 'fee', label: '(うち手数料)' },
  ] },
  { title: '貯蓄', items: [{ key: 'move:saving', label: '貯金へ移動' }, { key: 'move:fun', label: '娯楽費へ移動' }, { key: 'pool:use', label: 'プールから使用' }] },
  { title: '結果', items: [{ key: 'free:remain', label: '自由枠 残り' }] },
];

/** 登録済み期間のデータから行の値を作る */
export function periodItems(d: PeriodData): Map<string, number> {
  const m = new Map<string, number>();
  const p = d.period;
  if (!p || !d.summary) return m;
  const s = d.summary;
  m.set('income:salary', p.salary);
  m.set('income:bonus', p.bonus_on ? p.bonus : 0);
  m.set('income:received', s.received);
  for (const f of d.fixed) m.set(`fixed:${f.name}`, (m.get(`fixed:${f.name}`) ?? 0) + f.amount);
  m.set('fixed:total', d.fixedTotal);
  for (const c of ['food', 'transport', 'fun', 'extra', 'other'] as const) m.set(`cat:${c}`, s.byCategory[c]);
  m.set('fee', d.txs.filter((t) => t.purpose_name === '手数料').reduce((a, t) => a + t.amount, 0));
  m.set('move:saving', p.saving_move);
  m.set('move:fun', p.fun_move);
  m.set('pool:use', s.poolUse);
  m.set('free:remain', s.freeRemain);
  return m;
}

export function average(values: (number | undefined)[]): number | null {
  const v = values.filter((x): x is number => x !== undefined);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
