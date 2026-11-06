import { useEffect, useRef } from 'react';
import { SourceAmount } from './SourceAmount';
import { Empty } from './ui';
import * as repo from '../db/repo';
import { withdrawDate } from '../lib/budget';
import { fmtMD, todayISO } from '../lib/date';
import { yen } from '../lib/period';
import { useApp } from '../state/AppContext';
import { usePeriodData } from '../state/usePeriodData';

/**
 * 固定費の引き落とし状況 (Excel「固定費支払い予定表」)。
 * - mode = check: ✓ (引落済) のみ切り替え (ダッシュボード)
 * - mode = edit : ✓ と引落額を編集 (入力・照合)
 * 引落済はグレー、未引落は強調、引落日を過ぎた未チェックは警告色。
 */
export function FixedChecklist({ mode, highlight }: { mode: 'check' | 'edit'; highlight?: number | null }) {
  const { ym, mutate } = useApp();
  const { range, fixed, period } = usePeriodData();
  const today = todayISO();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlight) ref.current?.querySelector(`[data-fixed="${highlight}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlight]);

  if (!period) return <Empty>この期間は給料が未登録のため、固定費はありません</Empty>;
  const items = fixed
    .map((f) => ({ ...f, date: withdrawDate(range, f.withdraw_day) }))
    .sort((a, b) => (a.paid - b.paid) || (a.date ?? '9').localeCompare(b.date ?? '9'));
  if (items.length === 0) return <Empty>固定費がありません</Empty>;
  const paid = items.filter((f) => f.paid).reduce((s, f) => s + f.actual, 0);
  const unpaid = items.filter((f) => !f.paid).reduce((s, f) => s + f.actual, 0);

  return (
    <div className={`fixed-check fc-${mode}`} ref={ref}>
      <p className="fc-sum">
        <span>引落済 <strong>{yen(paid)}</strong></span>
        <span>未引落 <strong className={unpaid ? 'warn' : ''}>{yen(unpaid)}</strong></span>
      </p>
      <ul>
        {items.map((f) => {
          const overdue = !f.paid && f.date && f.date < today;
          return (
            <li key={f.fixed_cost_id} data-fixed={f.fixed_cost_id} className={`${f.paid ? 'paid' : 'unpaid'} ${overdue ? 'overdue' : ''} ${highlight === f.fixed_cost_id ? 'hl' : ''}`}>
              <input type="checkbox" checked={!!f.paid} aria-label={`${f.name} 引落済`} onChange={(e) => mutate((db) => repo.setFixedPaid(db, ym, f.fixed_cost_id, e.target.checked))} />
              <time>{f.date ? fmtMD(f.date) : '—'}</time>
              <span className="fc-name">{f.name}</span>
              {mode === 'edit' ? (
                <SourceAmount label={`${f.name}の引落額`} input={f.actual_input} auto={f.auto} onSet={(v) => mutate((db) => repo.setActualFixed(db, ym, f.fixed_cost_id, v))} />
              ) : (
                <strong>{yen(f.actual)}</strong>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
