import { budgetItems, budgetTone } from '../lib/budget';
import { todayISO } from '../lib/date';
import { elapsedDays, yen } from '../lib/period';
import { go } from '../state/router';
import { usePeriodData } from '../state/usePeriodData';

/**
 * 予算枠の簡易表示 (食費・臨時費用・課金・娯楽費その他 + 自由枠)。
 * variant = pane: 右側の縦パネル (広い画面) / strip: ヘッダ下の横一列 (狭い画面)
 */
export function BudgetPane({ variant }: { variant: 'pane' | 'strip' }) {
  const { range, period, summary: s } = usePeriodData();
  const today = todayISO();
  const isCurrent = today >= range.start && today <= range.end;
  const pace = isCurrent ? elapsedDays(range, today) / range.days : undefined;

  if (!period || !s) {
    return (
      <div className={`budget-pane ${variant} empty`}>
        <span className="muted">給料が未登録</span>
        <button className="link" onClick={() => go('budget')}>登録する</button>
      </div>
    );
  }
  const items = budgetItems(period, s);
  const freeTone = s.freeRemain < 0 ? 'danger' : s.freeTotal > 0 && s.freeRemain / s.freeTotal < 0.2 ? 'warn' : 'ok';

  return (
    <div className={`budget-pane ${variant}`} aria-label="予算の状況">
      <button type="button" className={`bp-free tone-${freeTone}`} onClick={() => go('dashboard')} title="ダッシュボードを開く">
        <small>自由枠 残り</small>
        <strong>{yen(s.freeRemain)}</strong>
        {variant === 'pane' && <span>/ {yen(s.freeTotal)}{pace !== undefined && ` · ${elapsedDays(range, today)}/${range.days}日目`}</span>}
      </button>
      {items.map((b) => {
        const t = budgetTone(b.used, b.limit, b.paced ? pace : undefined);
        const ratio = b.limit > 0 ? Math.min(1, b.used / b.limit) : b.used > 0 ? 1 : 0;
        return (
          <div key={b.key} className={`bp-item tone-${t.tone}`} title={`${b.label}: ${yen(b.used)} / ${yen(b.limit)} (${t.text})`}>
            <div className="bp-head">
              <span>{b.label}</span>
              {variant === 'pane' && <em>{t.text}</em>}
            </div>
            <div className="bp-remain"><small>残り</small> {yen(b.limit - b.used)}</div>
            <div className="bp-bar">
              <i style={{ width: `${ratio * 100}%` }} />
              {b.paced && pace !== undefined && <b style={{ left: `${pace * 100}%` }} />}
            </div>
            {variant === 'pane' && <div className="bp-foot">{yen(b.used)} / {yen(b.limit)}</div>}
          </div>
        );
      })}
    </div>
  );
}
