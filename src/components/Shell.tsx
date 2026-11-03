import type { ReactNode } from 'react';
import { Emblem } from './Emblem';

export const NAV = [
  { key: 'dashboard', label: 'ダッシュボード', icon: '◎', mobile: true },
  { key: 'entry', label: '取引入力', icon: '＋', mobile: true },
  { key: 'list', label: '取引一覧', icon: '≡', mobile: true },
  { key: 'wallets', label: '口座・残高', icon: '¥', mobile: true },
  { key: 'fixed', label: '固定費', icon: '⟳', mobile: false },
  { key: 'budget', label: '月次予算', icon: '◔', mobile: false },
  { key: 'pools', label: '貯蓄・プール', icon: '▤', mobile: false },
  { key: 'analysis', label: '分析', icon: '▥', mobile: true },
  { key: 'master', label: 'マスタ管理', icon: '☰', mobile: false },
  { key: 'settings', label: '設定', icon: '⚙', mobile: false },
] as const;

interface Props {
  periodYear: number;
  periodLabel: string;
  children: ReactNode;
}

export function Shell({ periodYear, periodLabel, children }: Props) {
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
          {NAV.map((n, i) => (
            <a key={n.key} href="#" className={i === 0 ? 'active' : ''} aria-current={i === 0 ? 'page' : undefined}>
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
            <button aria-label="前の期間">◀</button>
            <div>
              <small>{periodYear} 期間</small>
              <strong>{periodLabel}</strong>
            </div>
            <button aria-label="次の期間">▶</button>
          </div>
          <div className="status">
            <span className="db-pill" title="DB接続状態">
              <i /> OneDrive / money.sqlite
            </span>
            <button className="icon-btn" aria-label="ロック (PIN)">🔒</button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      <nav className="bottom-nav">
        {NAV.filter((n) => n.mobile).map((n, i) => (
          <a key={n.key} href="#" className={i === 0 ? 'active' : ''}>
            <span className="ico">{n.icon}</span>
            {n.label.replace('ダッシュボード', 'ホーム')}
          </a>
        ))}
      </nav>
    </div>
  );
}
