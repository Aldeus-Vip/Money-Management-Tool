import type { ReactNode } from 'react';
import { Emblem } from './Emblem';
import { useApp, type SaveState } from '../state/AppContext';
import { go, type Route } from '../state/router';
import { fmtMD, parseYM, shiftYM } from '../lib/date';
import { periodRange } from '../db/repo';

export const NAV: { key: Route; label: string; icon: string; mobile: boolean }[] = [
  { key: 'dashboard', label: 'ダッシュボード', icon: '◎', mobile: true },
  { key: 'entry', label: '取引入力', icon: '＋', mobile: true },
  { key: 'list', label: '取引一覧', icon: '≡', mobile: true },
  { key: 'wallets', label: '口座・残高', icon: '□', mobile: false },
  { key: 'fixed', label: '固定費', icon: '⟳', mobile: false },
  { key: 'budget', label: '月次予算', icon: '◆', mobile: true },
  { key: 'pools', label: '貯蓄・プール', icon: '▤', mobile: false },
  { key: 'analysis', label: '分析', icon: '▥', mobile: false },
  { key: 'master', label: 'マスタ管理', icon: '☰', mobile: false },
  { key: 'settings', label: '設定', icon: '⚙', mobile: true },
];

const SAVE_LABEL: Record<SaveState, string> = {
  saved: '保存済み',
  pending: '未保存',
  saving: '保存中…',
  error: '保存エラー',
  conflict: '外部で変更あり',
};

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { ym, setYm, db, rev, storage, saveState, lock, saveNow } = useApp();
  void rev;
  const range = periodRange(db, ym);
  const { year } = parseYM(ym);

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <Emblem />
          <div>
            <strong>MONEY</strong>
            <span>MANAGEMENT</span>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <a key={n.key} href={`#/${n.key}`} className={route === n.key ? 'active' : ''} aria-current={route === n.key ? 'page' : undefined}>
              <span className="ico">{n.icon}</span>
              {n.label}
            </a>
          ))}
        </nav>
        <footer className="rail-foot">MAENO SYSTEM ENGINEERING</footer>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="mobile-brand">
            <Emblem size={34} />
          </div>
          <div className="period">
            <button aria-label="前の期間" onClick={() => setYm(shiftYM(ym, -1))}>◀</button>
            <div>
              <small>{year} 期間</small>
              <strong>{fmtMD(range.start)} – {fmtMD(range.end)}</strong>
            </div>
            <button aria-label="次の期間" onClick={() => setYm(shiftYM(ym, 1))}>▶</button>
          </div>
          <div className="status">
            <button
              className={`db-pill save-${saveState}`}
              title={`${storage?.label ?? ''} — ${SAVE_LABEL[saveState]}`}
              onClick={() => (saveState === 'conflict' ? go('settings') : void saveNow())}
            >
              <i /> <span>{storage?.label}</span> <b>{SAVE_LABEL[saveState]}</b>
            </button>
            <button className="icon-btn" aria-label="ロック" title="ロック" onClick={lock}>🔒</button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      <nav className="bottom-nav">
        {NAV.filter((n) => n.mobile).map((n) => (
          <a key={n.key} href={`#/${n.key}`} className={route === n.key ? 'active' : ''}>
            <span className="ico">{n.icon}</span>
            {n.key === 'dashboard' ? 'ホーム' : n.label.replace('取引', '')}
          </a>
        ))}
      </nav>
    </div>
  );
}
