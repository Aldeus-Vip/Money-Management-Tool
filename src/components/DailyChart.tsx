import type { CategoryCode } from '../db/repo';
import { CATEGORY_COLOR, CATEGORY_LABEL, EXPENSE_CODES } from '../lib/categories';
import { addDays, fmtMD, type ISODate } from '../lib/date';
import { yen } from '../lib/period';

interface Props {
  data: Record<CategoryCode, number>[];
  start: ISODate;
  today: ISODate;
}

/** 日別×区分の積み上げ棒グラフ (Excel「使用状況」相当) */
export function DailyChart({ data, start, today }: Props) {
  const W = 660;
  const H = 180;
  const padL = 44;
  const padB = 22;
  const padT = 10;
  const total = (d: Record<CategoryCode, number>) => EXPENSE_CODES.reduce((s, c) => s + d[c], 0);
  const max = Math.max(4000, ...data.map(total));
  const n = data.length;
  const step = (W - padL) / n;
  const bw = Math.max(4, step * 0.62);
  const y = (v: number) => padT + (H - padB - padT) * (1 - v / max);
  const ticks = [0, max / 2, max];

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="日別支出">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="grid" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="axis">
              {t === 0 ? '0' : `${Math.round(t / 1000)}k`}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * step + (step - bw) / 2;
          const date = addDays(start, i);
          let acc = 0;
          return (
            <g key={i}>
              {date === today && <rect x={x - 2} y={padT} width={bw + 4} height={H - padB - padT} className="today" />}
              {date > today ? (
                <rect x={x} y={H - padB - 2} width={bw} height="2" className="future" />
              ) : (
                EXPENSE_CODES.map((c) => {
                  const v = d[c];
                  if (!v) return null;
                  const top = y(acc + v);
                  const h = y(acc) - top;
                  acc += v;
                  return (
                    <rect key={c} x={x} y={top} width={bw} height={Math.max(0, h - 1)} rx="1.5" fill={CATEGORY_COLOR[c]}>
                      <title>{`${fmtMD(date)} ${CATEGORY_LABEL[c]} ${yen(v)}`}</title>
                    </rect>
                  );
                })
              )}
              {(i % 5 === 0 || i === n - 1) && (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="axis">
                  {fmtMD(date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="legend">
        {EXPENSE_CODES.map((c) => (
          <span key={c}>
            <i style={{ background: CATEGORY_COLOR[c] }} />
            {CATEGORY_LABEL[c]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
