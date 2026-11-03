import { useId } from 'react';

interface Props {
  /** 0〜1 の残り割合 */
  ratio: number;
  label: string;
  value: string;
  sub: string;
  tone?: 'ok' | 'warn' | 'danger';
}

/** 壁紙中央のリングを模したゲージ: メタリック外周 + シアンの残量アーク */
export function RingGauge({ ratio, label, value, sub, tone = 'ok' }: Props) {
  const gid = useId();
  const r = 82;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, ratio));
  const bolts = Array.from({ length: 12 }, (_, i) => (i * Math.PI * 2) / 12);
  return (
    <div className={`ring tone-${tone}`}>
      <svg viewBox="0 0 220 220" role="img" aria-label={`${label} ${value}`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f4f7f9" />
            <stop offset="40%" stopColor="#7d8790" />
            <stop offset="65%" stopColor="#dfe5ea" />
            <stop offset="100%" stopColor="#4c545b" />
          </linearGradient>
        </defs>
        <circle cx="110" cy="110" r="102" fill="none" stroke={`url(#${gid})`} strokeWidth="12" />
        {bolts.map((a, i) => (
          <circle key={i} cx={110 + Math.cos(a) * 102} cy={110 + Math.sin(a) * 102} r="2.6" fill="#2a3036" stroke="#c9d0d6" strokeWidth="0.8" />
        ))}
        <circle cx="110" cy="110" r={r} fill="#04070b" stroke="#0e2a33" strokeWidth="10" />
        <circle
          className="ring-arc"
          cx="110"
          cy="110"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${c * clamped} ${c}`}
          transform="rotate(-90 110 110)"
        />
      </svg>
      <div className="ring-center">
        <span className="ring-label">{label}</span>
        <span className="ring-value">{value}</span>
        <span className="ring-sub">{sub}</span>
      </div>
    </div>
  );
}
