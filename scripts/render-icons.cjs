/** public/icons/*.svg → PNG (各サイズ)。使い方: node scripts/render-icons.cjs */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'public', 'icons');
const jobs = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
  ['icon-maskable.svg', 'apple-touch-icon.png', 180], // iOS は自前で角丸にするため四角い版
];
(async () => {
  const b = await chromium.launch();
  for (const [src, out, size] of jobs) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    const svg = fs.readFileSync(path.join(dir, src), 'utf8');
    await p.setContent(`<style>html,body{margin:0;background:transparent}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}">`);
    await p.screenshot({ path: path.join(dir, out), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await p.close();
  }
  await b.close();
})();
