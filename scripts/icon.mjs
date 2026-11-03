/**
 * アプリアイコンの SVG を生成する (MSE 壁紙のメタリックリング + シアン)。
 * 使い方: node scripts/icon.mjs <variant> > out.svg   variant = mse | yen | gauge | favicon
 */
const variant = process.argv[2] ?? 'gauge';
const S = 512;
const C = S / 2;

const defs = `
  <defs>
    <radialGradient id="bg" cx="50%" cy="46%" r="70%">
      <stop offset="0%" stop-color="#0f3442"/>
      <stop offset="55%" stop-color="#07111b"/>
      <stop offset="100%" stop-color="#03060a"/>
    </radialGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f6f8fa"/>
      <stop offset="38%" stop-color="#7d8790"/>
      <stop offset="62%" stop-color="#e4e9ed"/>
      <stop offset="100%" stop-color="#4a525a"/>
    </linearGradient>
    <linearGradient id="metalText" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="50%" stop-color="#b9c2ca"/>
      <stop offset="52%" stop-color="#8b959e"/>
      <stop offset="100%" stop-color="#e9edf0"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="7" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000" flood-opacity="0.7"/>
    </filter>
  </defs>`;

/** 左右から中心へ伸びる回路線 */
function circuits() {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const y = 104 + i * 50;
    const cyan = i % 2 === 0;
    const dy = i < 3 ? 22 : i > 3 ? -22 : 0;
    const col = cyan ? '#19e3e8' : '#9aa6b2';
    const op = cyan ? 0.55 : 0.28;
    for (const side of [0, 1]) {
      const x0 = side ? S : 0;
      const dir = side ? -1 : 1;
      const x1 = x0 + dir * 46;
      const x2 = x1 + dir * 26;
      const x3 = x0 + dir * 108;
      out.push(`<path d="M${x0} ${y} H${x1} L${x2} ${y + dy} H${x3}" stroke="${col}" stroke-opacity="${op}" stroke-width="5" fill="none"/>`);
      out.push(`<circle cx="${x3 + dir * 7}" cy="${y + dy}" r="6" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="4"/>`);
    }
  }
  return out.join('');
}

function ring() {
  const R = 168;
  const bolts = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI * 2) / 12;
    return `<circle cx="${(C + Math.cos(a) * R).toFixed(1)}" cy="${(C + Math.sin(a) * R).toFixed(1)}" r="7" fill="#2a3138" stroke="#d5dbe0" stroke-width="2.5"/>`;
  }).join('');
  return `
    <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="url(#metal)" stroke-width="36" filter="url(#shadow)"/>
    ${bolts}
    <circle cx="${C}" cy="${C}" r="138" fill="#03070b"/>
    <circle cx="${C}" cy="${C}" r="134" fill="none" stroke="#19e3e8" stroke-width="9" filter="url(#glow)"/>`;
}

function gaugeArc() {
  const r = 112;
  const c = 2 * Math.PI * r;
  return `
    <circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="#0e2a33" stroke-width="16"/>
    <circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="#19e3e8" stroke-width="16" stroke-linecap="round"
      stroke-dasharray="${(c * 0.72).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${C} ${C})" filter="url(#glow)"/>`;
}

const text = (t, size, y) =>
  `<text x="${C}" y="${y}" text-anchor="middle" font-family="Orbitron, 'Arial Black', Arial, sans-serif" font-weight="800" font-size="${size}" fill="url(#metalText)" stroke="#2b3238" stroke-width="2" filter="url(#shadow)">${t}</text>`;

/** ¥ はフォント差を避けるためパスで描く */
function yen(scale = 1, cy = C) {
  const w = 30 * scale;
  return `<g filter="url(#shadow)" transform="translate(${C} ${cy}) scale(${scale})">
    <path d="M-62 -84 L0 4 L62 -84 M0 4 V88 M-50 14 H50 M-50 46 H50" fill="none" stroke="url(#metalText)" stroke-width="${w / scale}" stroke-linecap="square" stroke-linejoin="miter"/>
  </g>`;
}

let body;
if (variant === 'favicon') {
  // 16〜32px でも潰れないよう簡略化
  const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6f8fa"/><stop offset=".45" stop-color="#7d8790"/><stop offset=".7" stop-color="#e4e9ed"/><stop offset="1" stop-color="#4a525a"/></linearGradient></defs>
  <rect width="64" height="64" rx="14" fill="#05090e"/>
  <circle cx="32" cy="32" r="25" fill="none" stroke="url(#m)" stroke-width="6"/>
  <circle cx="32" cy="32" r="19.5" fill="none" stroke="#19e3e8" stroke-width="3"/>
  <path d="M24 20 L32 32 L40 20 M32 32 V45 M25.5 34 H38.5 M25.5 39.5 H38.5" fill="none" stroke="#e9edf0" stroke-width="3.6" stroke-linecap="square"/>
</svg>`;
  process.stdout.write(out);
  process.exit(0);
} else if (variant === 'mse') {
  body = ring() + text('MSE', 92, C + 33);
} else if (variant === 'yen') {
  body = ring() + yen(1.05);
} else {
  body = ring() + gaugeArc() + yen(0.78);
}

const maskable = process.argv[3] === 'maskable';
process.stdout.write(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">${defs}
  <rect width="${S}" height="${S}" ${maskable ? '' : 'rx="112"'} fill="url(#bg)"/>
  ${circuits()}
  ${body}
</svg>`);
