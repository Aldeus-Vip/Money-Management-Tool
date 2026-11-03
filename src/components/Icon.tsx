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
