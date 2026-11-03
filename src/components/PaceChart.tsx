import { addDays, fmtMD, type ISODate } from '../lib/date';
import { yen } from '../lib/period';

interface Props {
  title: string;
  budget: number;
  /** 日別の使用額 */
  daily: number[];
  start: ISODate;
  today: ISODate;
  color: string;
}

/** 予算消化ペース: 実績の累計 vs 理想ライン (Excel「使用状況」のグラフ) */
export function PaceChart({ title, budget, daily, start, today, color }: Props) {
  const W = 560, H = 200, padL = 52, padB = 22, padT = 12;
  const n = daily.length;
  const cum: number[] = [];
  daily.forEach((v, i) => cum.push((cum[i - 1] ?? 0) + v));
  const lastIdx = Math.min(n - 1, Math.max(-1, daily.findIndex((_, i) => addDays(start, i) === today)));
  const shown = lastIdx >= 0 ? cum.slice(0, lastIdx + 1) : today > addDays(start, n - 1) ? cum : [];
  const max = Math.max(budget, ...cum, 1000) * 1.08;
  const x = (i: number) => padL + ((W - padL - 8) * i) / Math.max(1, n - 1);
  const y = (v: number) => padT + (H - padB - padT) * (1 - v / max);
  const used = shown[shown.length - 1] ?? 0;
  const ideal = shown.length ? (budget / n) * shown.length : 0;
  const over = used > ideal;

  return (
    <figure className="chart pace">
      <figcaption className="pace-head">
        <strong>{title}</strong>
        <span>{yen(used)} / {yen(budget)}</span>
        {shown.length > 0 && <em className={over ? 'warn' : 'ok'}>{over ? `理想より +${yen(used - ideal)}` : `理想より −${yen(ideal - used)}`}</em>}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}の消化ペース`}>
        {[0, budget / 2, budget].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} className={t === budget ? 'budget-line' : 'grid'} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="axis">{t >= 1000 ? `${Math.round(t / 1000)}k` : Math.round(t)}</text>
          </g>
        ))}
        <line x1={x(0)} y1={y(budget / n)} x2={x(n - 1)} y2={y(budget)} className="ideal" />
        {shown.length > 0 && (
          <>
            <polyline points={shown.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            <circle cx={x(shown.length - 1)} cy={y(used)} r="4" fill={color} />
          </>
        )}
        {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="axis">{fmtMD(addDays(start, i))}</text>
        ))}
      </svg>
      <div className="legend"><span><i style={{ background: color }} />実績 (累計)</span><span><i className="dash" />理想ペース</span></div>
    </figure>
  );
}
