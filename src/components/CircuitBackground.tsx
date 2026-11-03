/** 壁紙の回路パターンを模した背景 (装飾のみ) */
export function CircuitBackground() {
  const lines = Array.from({ length: 14 }, (_, i) => i);
  return (
    <svg className="circuit-bg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id="cb-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#0f3a4a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#05080d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#cb-glow)" />
      {lines.map((i) => {
        const y = 60 + i * 58;
        const cyan = i % 3 === 0;
        const bend = 220 + (i % 4) * 40;
        return (
          <g key={i} stroke={cyan ? '#19e3e8' : '#8a96a3'} strokeOpacity={cyan ? 0.22 : 0.1} fill="none" strokeWidth="1.2">
            <path d={`M0 ${y} H${bend} L${bend + 60} ${y + (i < 7 ? 40 : -40)} H${bend + 160}`} />
            <circle cx={bend + 166} cy={y + (i < 7 ? 40 : -40)} r="5" />
            <path d={`M1600 ${y} H${1600 - bend} L${1540 - bend} ${y + (i < 7 ? 40 : -40)} H${1440 - bend}`} />
            <circle cx={1434 - bend} cy={y + (i < 7 ? 40 : -40)} r="5" />
          </g>
        );
      })}
    </svg>
  );
}
