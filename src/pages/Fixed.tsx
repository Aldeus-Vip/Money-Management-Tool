import { Empty, PageHead } from '../components/ui';
import * as repo from '../db/repo';
import { withdrawDate } from '../lib/budget';
import { addDays, fmtMD, fmtYM, fromISO, todayISO } from '../lib/date';
import { yen } from '../lib/period';
import { useApp } from '../state/AppContext';
import { go } from '../state/router';
import { usePeriodData } from '../state/usePeriodData';

const WD = ['日', '月', '火', '水', '木', '金', '土'];

export function Fixed() {
  const { ym, mutate } = useApp();
  const { range, period, fixed, balances } = usePeriodData();
  const today = todayISO();
  const bank = balances.find((b) => b.wallet.kind === 'bank');

  if (!period) {
    return (
      <div className="page narrow">
        <PageHead title={`固定費 — ${fmtYM(ym)}`} />
        <section className="panel notice">
          <p>この期間は給料が未登録のため、固定費がありません。</p>
          <button className="btn primary" onClick={() => go('budget')}>月次予算へ</button>
        </section>
      </div>
    );
  }

  const items = fixed
    .map((f) => ({ ...f, date: withdrawDate(range, f.withdraw_day) }))
    .sort((a, b) => (a.date ?? '9').localeCompare(b.date ?? '9'));
  const paid = items.filter((f) => f.paid).reduce((s, f) => s + f.amount, 0);
  const unpaid = items.filter((f) => !f.paid).reduce((s, f) => s + f.amount, 0);
  const overdue = items.filter((f) => !f.paid && f.date && f.date < today);
  const toggle = (id: number, v: boolean) => mutate((db) => repo.setFixedPaid(db, ym, id, v));

  // カレンダー (期間の初日の週から)
  const first = fromISO(range.start).getDay();
  const cells = Array.from({ length: Math.ceil((first + range.days) / 7) * 7 }, (_, i) => {
    const idx = i - first;
    return idx >= 0 && idx < range.days ? addDays(range.start, idx) : null;
  });

  return (
    <div className="page">
      <PageHead title={`固定費 — ${fmtYM(ym)}`}>
        <a className="btn ghost" href="#/budget">金額を調整</a>
      </PageHead>

      <section className="stat-row">
        <div className="panel stat"><span>合計</span><strong>{yen(paid + unpaid)}</strong><small>{items.length} 件</small></div>
        <div className="panel stat"><span>引落済</span><strong>{yen(paid)}</strong><small>{items.filter((f) => f.paid).length} 件</small></div>
        <div className="panel stat"><span>未引落</span><strong className={unpaid ? 'warn' : ''}>{yen(unpaid)}</strong><small>{items.filter((f) => !f.paid).length} 件</small></div>
        {bank && <div className="panel stat"><span>口座 見込み残高</span><strong className={bank.projected < 0 ? 'neg' : ''}>{yen(bank.projected)}</strong><small>未引落を全て引いた後</small></div>}
      </section>

      {overdue.length > 0 && (
        <p className="alert warn">▲ 引落日を過ぎて未チェック: {overdue.map((f) => f.name).join('、')}</p>
      )}

      <div className="grid-2">
        <section className="panel">
          <h2>引落予定</h2>
          {items.length === 0 ? (
            <Empty>固定費がありません</Empty>
          ) : (
            <ul className="fixed-sched">
              {items.map((f) => (
                <li key={f.fixed_cost_id} className={`${f.paid ? 'paid' : ''} ${!f.paid && f.date && f.date < today ? 'overdue' : ''}`}>
                  <label className="check">
                    <input type="checkbox" checked={!!f.paid} onChange={(e) => toggle(f.fixed_cost_id, e.target.checked)} aria-label={`${f.name} 引落済`} />
                  </label>
                  <time>{f.date ? fmtMD(f.date) : '日付未設定'}</time>
                  <span>{f.name}</span>
                  <strong>{yen(f.amount)}</strong>
                </li>
              ))}
            </ul>
          )}
          <p className="note">✓ を付けると口座の「現在の残高」から引かれます。</p>
        </section>

        <section className="panel">
          <h2>カレンダー</h2>
          <div className="cal">
            {WD.map((w) => <b key={w}>{w}</b>)}
            {cells.map((d, i) => {
              const hits = d ? items.filter((f) => f.date === d) : [];
              return (
                <div key={i} className={`cal-cell ${!d ? 'out' : ''} ${d === today ? 'today' : ''}`}>
                  {d && <span className="cal-day">{fmtMD(d)}</span>}
                  {hits.map((f) => <span key={f.fixed_cost_id} className={`cal-item ${f.paid ? 'paid' : ''}`} title={`${f.name} ${yen(f.amount)}`}>{f.name}</span>)}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
