import { yen } from '../lib/period';

interface Props {
  label: string;
  used: number;
  limit: number;
  /** 経過日数の割合 (ペース表示する場合のみ) */
  pace?: number;
}

/** 予算枠の消化バー。ペースマーカー = 今日までに使ってよい理想ライン */
export function BudgetCard({ label, used, limit, pace }: Props) {
  const ratio = limit > 0 ? used / limit : 0;
  const remain = limit - used;
  // エラーは「残りがマイナス」のときだけ (残り 0 = ちょうど使い切りは正常)
  const overPace = pace !== undefined && ratio > pace && remain > 0;
  const tone = remain < 0 ? 'danger' : (ratio >= 0.85 && remain > 0) || overPace ? 'warn' : 'ok';
  const toneText = remain < 0 ? '超過' : remain === 0 && limit > 0 ? '使い切り' : tone === 'warn' ? (overPace && ratio < 0.85 ? 'ペース超過' : '残りわずか') : '順調';
  return (
    <article className={`panel budget tone-${tone}`}>
      <header className="budget-head">
        <h3>{label}</h3>
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
