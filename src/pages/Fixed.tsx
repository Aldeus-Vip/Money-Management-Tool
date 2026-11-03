import { SourceAmount, SourceLegend } from '../components/SourceAmount';
import { FixedNotices } from '../components/FixedNotices';
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
  const paid = items.filter((f) => f.paid).reduce((s, f) => s + f.actual, 0);
  const unpaid = items.filter((f) => !f.paid).reduce((s, f) => s + f.actual, 0);
  const plannedTotal = items.reduce((s, f) => s + f.planned, 0);
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
        <div className="panel stat"><span>予算額 合計</span><strong>{yen(plannedTotal)}</strong><small>{items.length} 件 (予算の計算に使用)</small></div>
        <div className="panel stat"><span>引落済 (引落額)</span><strong>{yen(paid)}</strong><small>{items.filter((f) => f.paid).length} 件</small></div>
        <div className="panel stat"><span>未引落</span><strong className={unpaid ? 'warn' : ''}>{yen(unpaid)}</strong><small>{items.filter((f) => !f.paid).length} 件</small></div>
        {bank && <div className="panel stat"><span>口座 見込み残高</span><strong className={bank.projected < 0 ? 'neg' : ''}>{yen(bank.projected)}</strong><small>未引落を全て引いた後</small></div>}
      </section>

      <section className="panel">
        <h2>今期の固定費のお知らせ</h2>
        <FixedNotices ym={ym} />
      </section>

      {overdue.length > 0 && (
        <p className="alert warn">▲ 引落日を過ぎて未チェック: {overdue.map((f) => f.name).join('、')}</p>
      )}

      <div className="stack">
        <section className="panel fixed-panel">
          <h2>引落予定</h2>
          <SourceLegend />
          {items.length === 0 ? (
            <Empty>固定費がありません</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table fixed-table">
                <thead>
                  <tr><th>済</th><th>引落日</th><th>名称</th><th>予算額</th><th>引落額</th><th className="r">差</th></tr>
                </thead>
                <tbody>
                  {items.map((f) => {
                    const diff = f.actual - f.planned;
                    return (
                      <tr key={f.fixed_cost_id} className={`${f.paid ? 'paid' : ''} ${!f.paid && f.date && f.date < today ? 'overdue' : ''}`}>
                        <td className="center"><input type="checkbox" checked={!!f.paid} onChange={(e) => toggle(f.fixed_cost_id, e.target.checked)} aria-label={`${f.name} 引落済`} /></td>
                        <td className="day">{f.date ? fmtMD(f.date) : '—'}</td>
                        <td className="name">{f.name}<small>{autoLabel(f)}</small></td>
                        <td data-label="予算額"><SourceAmount label={`${f.name}の予算額`} input={f.planned_input} auto={f.auto} onSet={(v) => mutate((db) => repo.setPlanned(db, ym, f.fixed_cost_id, v))} /></td>
                        <td data-label="引落額"><SourceAmount label={`${f.name}の引落額`} input={f.actual_input} auto={f.auto} onSet={(v) => mutate((db) => repo.setActualFixed(db, ym, f.fixed_cost_id, v))} /></td>
                        <td className={`num ${diff > 0 ? 'neg' : ''}`} data-label="差">{diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${yen(diff)}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="note">
            予算額 = 月次予算 (自由枠) の計算に使う金額。引落額 = 口座残高から引く金額 (✓ を付けた時点で「現在の残高」に反映)。
            請求額が分かったら引落額を入力してください。手入力した引落額は、次回以降の「過去平均」の計算にも使われます。
          </p>
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
                  {hits.map((f) => <span key={f.fixed_cost_id} className={`cal-item ${f.paid ? 'paid' : ''}`} title={`${f.name} ${yen(f.actual)}`}>{f.name}</span>)}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function autoLabel(f: repo.PeriodFixedCost): string {
  const base = f.mode === 'average' ? `過去平均${f.buffer ? '+バッファ' : ''}` : '固定額';
  const months = repo.monthsLabel(f.bill_months);
  const rule = f.auto_rule
    ? f.auto_rule.kind === 'once' ? 'その月だけの予定' : f.auto_rule.kind === 'yearly' ? `毎年${f.auto_rule.month}月の予定` : `${f.auto_rule.ym?.replace('-', '/')}〜の予定`
    : base;
  return months === '毎月' ? rule : `${months} · ${rule}`;
}
