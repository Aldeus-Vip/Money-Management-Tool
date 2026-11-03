import * as repo from '../db/repo';
import { fmtYM, type YM } from '../lib/date';
import { useQuery } from '../state/AppContext';

const ICON: Record<repo.FixedNotice['kind'], string> = { change: '▲', once: '◆', billed: '●', skip: '—' };

/** 固定費のお知らせ (年1回・隔月の請求 / 請求なし / 金額変更 / その月だけ) */
export function FixedNotices({ ym, title, compact }: { ym: YM; title?: string; compact?: boolean }) {
  const notices = useQuery((db) => repo.fixedNotices(db, ym), [ym]);
  if (notices.length === 0) return compact ? null : <p className="muted">{fmtYM(ym)} の固定費に特別な予定はありません</p>;
  return (
    <div className="fixed-notices">
      {title && <h3>{title}</h3>}
      <ul>
        {notices.map((n, i) => (
          <li key={i} className={n.kind}>
            <span className="fn-icon" aria-hidden>{ICON[n.kind]}</span>
            <strong>{n.name}</strong>
            <span>{n.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
