import { CATEGORY_COLOR, type Category } from '../mock/sampleData';
import { yen } from '../lib/period';

interface Props {
  data: Record<Category, number>[];
  totalDays: number;
  startDate: Date;
}

const CATS: Category[] = ['食費', '交通費', '娯楽費', '臨時費用', 'その他'];

/** 日別×区分の積み上げ棒グラフ (Excel「使用状況」相当) */
export function DailyChart({ data, totalDays, startDate }: Props) {
  const W = 660;
  const H = 180;
  const padL = 44;
  const padB = 22;
  const max = Math.max(4000, ...data.map((d) => CATS.reduce((s, c) => s + d[c], 0)));
  const step = (W - padL) / totalDays;
  const bw = Math.max(4, step * 0.62);
  const padT = 10;
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
        {Array.from({ length: totalDays }, (_, i) => {
          const d = data[i];
          const x = padL + i * step + (step - bw) / 2;
          let acc = 0;
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          return (
            <g key={i}>
              {d &&
                CATS.map((c) => {
                  const v = d[c];
                  if (!v) return null;
                  const top = y(acc + v);
                  const h = y(acc) - top;
                  acc += v;
                  return (
                    <rect key={c} x={x} y={top} width={bw} height={Math.max(0, h - 1)} rx="1.5" fill={CATEGORY_COLOR[c]}>
                      <title>{`${date.getMonth() + 1}/${date.getDate()} ${c} ${yen(v)}`}</title>
                    </rect>
                  );
                })}
              {!d && <rect x={x} y={H - padB - 2} width={bw} height="2" className="future" />}
              {(i % 5 === 0 || i === totalDays - 1) && (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="axis">
                  {`${date.getMonth() + 1}/${date.getDate()}`}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="legend">
        {CATS.map((c) => (
          <span key={c}>
            <i style={{ background: CATEGORY_COLOR[c] }} />
            {c}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
