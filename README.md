# Money Management Tool

Excel の家計管理シートを Web アプリ化したもの (個人利用)。

- UI: React + TypeScript + Vite (Dark / MSE テーマ)
- DB: SQLite ファイル (ローカル / OneDrive 同期フォルダ)。ブラウザ内 (sql.js) で動作し、サーバ不要
- **個人データ (DB ファイル・Excel) はこのリポジトリに含めない**

## 開発

```bash
npm install
npm run dev     # 開発サーバ
npm test        # テスト
npm run build   # ビルド
```

## ドキュメント

- `docs/01_requirements-analysis.md` 要件整理
- `docs/02_open-questions.md` 確認事項
- `docs/03_decisions.md` 決定事項
- `docs/04_phase1.md` Phase 1 の実装内容
- `docs/05_phase2.md` Phase 2 の実装内容
- `docs/06_excel-import-plan.md` Excel 取り込みの準備
- `docs/07_feedback-v1.md` フィードバック対応 (固定費・入力照合)
- `docs/08_fixed-schedules.md` 固定費の請求月と金額の予定

## アイコン

- アプリアイコン: `scripts/icon.mjs` で SVG を生成 (`gauge` / `yen` / `mse` / `favicon`)
- PNG の再生成: `node scripts/render-icons.cjs` (Playwright を使用)
- メニューのアイコン: `src/components/Icon.tsx`
