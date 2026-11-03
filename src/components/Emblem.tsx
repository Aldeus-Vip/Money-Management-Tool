import { useId } from 'react';

/** MSE 風のメタリックリング・エンブレム (CSS/SVG で再現) */
export function Emblem({ size = 44 }: { size?: number }) {
  const gid = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="MSE">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f2f5f7" />
          <stop offset="45%" stopColor="#8d979f" />
          <stop offset="70%" stopColor="#e3e8ec" />
          <stop offset="100%" stopColor="#5d666e" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill="none" stroke={`url(#${gid})`} strokeWidth="8" />
      <circle cx="50" cy="50" r="38" fill="#04070b" stroke="#19e3e8" strokeWidth="2.5" className="glow-stroke" />
      <text x="50" y="58" textAnchor="middle" fontFamily="Orbitron, sans-serif" fontWeight="700" fontSize="24" fill={`url(#${gid})`}>
        MSE
      </text>
    </svg>
  );
}
