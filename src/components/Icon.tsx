/** 線画アイコン (24×24, currentColor)。MSE テーマに合わせ細めの線・角丸 */
const PATHS: Record<string, string> = {
  // ダッシュボード: リングゲージ
  dashboard: 'M12 3a9 9 0 1 1-9 9 M12 3a9 9 0 0 0-6.4 2.6 M12 12l4.5-4.5 M12 12m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0',
  // 取引入力: ＋ 付きの円
  entry: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 8v8 M8 12h8',
  // 取引一覧: リスト
  list: 'M9 6h11 M9 12h11 M9 18h11 M4.5 6h.01 M4.5 12h.01 M4.5 18h.01',
  // 口座・残高: 財布
  wallets: 'M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3 M4 7.5V17a2 2 0 0 0 2 2h14V8H6.5A2.5 2.5 0 0 1 4 7.5 M16 13.5h.01',
  // 固定費: カレンダー + 繰り返し
  fixed: 'M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5 M9.5 15.5a2.5 2.5 0 1 0 2.5-2.5 M12 13l-1.2-1.2 M12 13l-1.2 1.2',
  // 月次予算: 円グラフ
  budget: 'M12 3v9h9 M12 3a9 9 0 1 0 9 9 M15 3.5a9 9 0 0 1 5.5 5.5H15z',
  // 貯蓄・プール: 金庫
  pools: 'M4 5h16v14H4z M4 19v2 M20 19v2 M14 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M14 9v1 M14 14v1 M7 9v6',
  // 分析: 棒グラフ
  analysis: 'M4 20h16 M7 20v-6 M11 20V8 M15 20v-9 M19 20V5',
  // マスタ: データベース
  master: 'M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  // 設定: スライダー
  settings: 'M4 6h9 M17 6h3 M4 12h3 M11 12h9 M4 18h11 M19 18h1 M15 4v4 M9 10v4 M17 16v4',
  // --- 口座・ウォレット・予算枠 ---
  bank: 'M3 10h18 M12 3l9 5H3z M5 10v8 M9.5 10v8 M14.5 10v8 M19 10v8 M3 21h18',
  card: 'M3 6h18v12H3z M3 10h18 M7 15h4',
  cash: 'M2.5 7h19v10h-19z M12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M6 10v4 M18 10v4',
  phone: 'M7 2.5h10v19H7z M10.5 18.5h3 M9.5 6.5h5v5h-5z',
  iccard: 'M3 6h18v12H3z M6.5 9.5h4v5h-4z M14 10h4 M14 13h4',
  piggy: 'M5 11a7 6 0 0 1 12.5-3.5L20 7l-.6 3.4A6 6 0 0 1 20 12c0 2-1 3.6-2.6 4.6L17 19h-2.5l-.4-1.4a8 8 0 0 1-3.2 0L10.5 19H8l-.6-2.5A6 6 0 0 1 5 12 M3 11h2 M14.5 9.5h.01 M10 7.5h3',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  food: 'M4 12h16a8 8 0 0 1-16 0z M7 8c0-1.5 1-1.5 1-3 M11 8c0-1.5 1-1.5 1-3 M15 8c0-1.5 1-1.5 1-3',
  gem: 'M6 4h12l3 5-9 11L3 9z M3 9h18 M9 4l3 5 3-5 M12 9v11',
  game: 'M6 8h12a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L15.5 13h-7l-1.1 1.8A3 3 0 0 1 2 13v-1a4 4 0 0 1 4-4z M7.5 10v4 M5.5 12h4 M15.5 11h.01 M18 12.5h.01',
  umbrella: 'M3 12a9 9 0 0 1 18 0z M12 12v6.5a2 2 0 0 1-4 0 M12 3v0',
  // ロック
  lock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3 M12 15v2',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
