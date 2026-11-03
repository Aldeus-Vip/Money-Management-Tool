import type { ReactNode } from 'react';
import { Emblem } from './Emblem';
import { Icon } from './Icon';
import { useApp, type SaveState } from '../state/AppContext';
import { go, type Route } from '../state/router';
import { fmtMD, parseYM, shiftYM } from '../lib/date';
import { periodRange } from '../db/repo';

export const NAV: { key: Route; label: string; mobile: boolean }[] = [
  { key: 'dashboard', label: 'ダッシュボード', mobile: true },
  { key: 'entry', label: '取引入力', mobile: true },
  { key: 'list', label: '取引一覧', mobile: true },
  { key: 'wallets', label: '口座・残高', mobile: false },
  { key: 'fixed', label: '固定費', mobile: false },
  { key: 'budget', label: '月次予算', mobile: true },
  { key: 'pools', label: '貯蓄・プール', mobile: false },
  { key: 'analysis', label: '分析', mobile: false },
  { key: 'master', label: 'マスタ管理', mobile: false },
  { key: 'settings', label: '設定', mobile: true },
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
              <span className="ico"><Icon name={n.key} /></span>
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
            <button className="icon-btn" aria-label="ロック" title="ロック" onClick={lock}><Icon name="lock" size={18} /></button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      <nav className="bottom-nav">
        {NAV.filter((n) => n.mobile).map((n) => (
          <a key={n.key} href={`#/${n.key}`} className={route === n.key ? 'active' : ''}>
            <span className="ico"><Icon name={n.key} /></span>
            {n.key === 'dashboard' ? 'ホーム' : n.label.replace('取引', '')}
          </a>
        ))}
      </nav>
    </div>
  );
}
