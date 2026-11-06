import { budgetTone } from '../lib/budget';
import { yen } from '../lib/period';
import { accent, VISUAL } from '../lib/visuals';
import { VIcon } from './VIcon';

interface Props {
  label: string;
  used: number;
  limit: number;
  /** 経過日数の割合 (ペース表示する場合のみ) */
  pace?: number;
  /** 色とアイコン (food / charge / fun / extra) */
  vkey?: 'food' | 'charge' | 'fun' | 'extra';
}

/** 予算枠の消化バー。ペースマーカー = 今日までに使ってよい理想ライン */
export function BudgetCard({ label, used, limit, pace, vkey }: Props) {
  const v = vkey ? VISUAL[vkey] : null;
  const ratio = limit > 0 ? used / limit : 0;
  const remain = limit - used;
  const { tone, text: toneText } = budgetTone(used, limit, pace);
  return (
    <article className={`panel budget tone-${tone} ${v ? 'accented' : ''}`} style={v ? accent(v) : undefined}>
      <header className="budget-head">
        <h3>{v && <VIcon v={v} />}{label}</h3>
        <span className="chip">{toneText}</span>
      </header>
      <p className="budget-remain">
        <small>残り</small> {yen(remain)}
      </p>
      <div className="bar" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
        <div className="bar-fill" style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        {pace !== undefined && <div className="bar-pace" style={{ left: `${pace * 100}%` }} title="理想ペース" />}
      </div>
      <p className="budget-foot">
        {yen(used)} / {yen(limit)}
        <span>{Math.round(ratio * 100)}%</span>
      </p>
    </article>
  );
}
