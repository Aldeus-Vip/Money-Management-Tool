import { BudgetCard } from '../components/BudgetCard';
import { DailyChart } from '../components/DailyChart';
import { FixedChecklist } from '../components/FixedChecklist';
import { FixedNotices } from '../components/FixedNotices';
import { NextReminder, ReminderPanel } from '../components/Reminders';
import { Empty } from '../components/ui';
import { budgetItems, dailyByCategory, withdrawDate } from '../lib/budget';
import { CATEGORY_COLOR } from '../lib/categories';
import { fmtMD, shiftYM, todayISO } from '../lib/date';
import { elapsedDays, yen } from '../lib/period';
import { useApp } from '../state/AppContext';
import { go } from '../state/router';
import { usePeriodData } from '../state/usePeriodData';

/**
 * ダッシュボード (Excel の銀行口座シート上部の配置に合わせる)
 * 1 段目: 口座残高 / 貯蓄残高 / 自由枠 / 次の予定
 * 2 段目: 食費 / 課金 / 娯楽費その他 / 臨時費用
 * 3 段目: 固定費の引き落とし状況 | 固定費以外の取引履歴
 */
export function Dashboard() {
  const { ym } = useApp();
  const { range, period, txs, transfers, fixed, summary: s, balances, pools } = usePeriodData();
  const today = todayISO();
  const elapsed = elapsedDays(range, today);
  const pace = elapsed / range.days;
  const isCurrent = today >= range.start && today <= range.end;

  const bank = balances.find((b) => b.wallet.kind === 'bank');
  const others = balances.filter((b) => !b.merged && b.wallet.kind !== 'bank');
  const poolTotal = pools.reduce((a, p) => a + p.balance, 0);

  // Excel の並び: 食費 / 課金 / 娯楽費その他 / 臨時費用
  const order = ['food', 'charge', 'fun', 'extra'];
  const budgets = s && period ? budgetItems(period, s).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)) : [];

  const alerts: { tone: 'warn' | 'danger'; text: string }[] = [];
  if (s) {
    if (s.freeRemain < 0) alerts.push({ tone: 'danger', text: `自由枠の残りがマイナスです (${yen(s.freeRemain)})` });
    for (const b of budgets) {
      const remain = b.limit - b.used;
      if (remain < 0) alerts.push({ tone: 'danger', text: `${b.label}が枠を ${yen(-remain)} 超えています` });
    }
  }
  for (const b of balances) if (b.unknown) alerts.push({ tone: 'danger', text: `${b.wallet.name}に不明金 ${yen(b.unknown)} があります` });
  const overdue = fixed.filter((f) => !f.paid && (withdrawDate(range, f.withdraw_day) ?? '9') < today);
  if (overdue.length) alerts.push({ tone: 'warn', text: `引落日を過ぎた未チェックの固定費: ${overdue.map((f) => f.name).join('、')}` });

  // 固定費以外の取引履歴 (取引 + 移動、新しい順)
  type Row = { key: string; date: string; label: string; sub: string; amount: number; color: string; txId?: number; income?: boolean };
  const history: Row[] = [
    ...txs.map((t) => ({
      key: `tx-${t.id}`, date: t.date, label: t.purpose_name ?? t.category_name, sub: `${t.category_name} · ${t.wallet_name}`,
      amount: t.amount, color: CATEGORY_COLOR[t.category_code], txId: t.id, income: t.category_code === 'income',
    })),
    ...transfers.map((t) => ({ key: `tr-${t.id}`, date: t.date, label: `${t.from_name} → ${t.to_name}`, sub: t.memo ?? '移動', amount: t.amount, color: 'var(--c-blue)' })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.key.localeCompare(a.key));

  return (
    <div className="dash2">
      {!period && (
        <section className="panel notice">
          <p>この期間の<strong>給料が未登録</strong>です。月次予算で登録すると、予算と自由枠が計算されます。</p>
          <button className="btn primary" onClick={() => go('budget')}>給料を登録する</button>
        </section>
      )}

      {/* 1 段目 */}
      <section className="dash-top">
        <button type="button" className="panel top-card bank" onClick={() => go('wallets')}>
          <span className="tc-label">{bank?.wallet.name ?? '口座'}</span>
          <strong className="tc-value">{yen(bank?.current ?? 0)}</strong>
          {bank && bank.fixedUnpaid > 0 && <span className="tc-sub">固定費引落後 {yen(bank.projected)}</span>}
          <span className="tc-wallets">
            {others.map((b) => (
              <span key={b.wallet.id} className={b.unknown ? 'ng' : ''}>{b.wallet.name} {yen(b.current)}</span>
            ))}
          </span>
        </button>
        <button type="button" className="panel top-card pool" onClick={() => go('pools')}>
          <span className="tc-label">貯蓄</span>
          <strong className="tc-value">{yen(poolTotal)}</strong>
          <span className="tc-wallets">
            {pools.map((p) => <span key={p.id}>{p.name} {yen(p.balance)}{p.moved ? ` (今期 +${yen(p.moved)})` : ''}</span>)}
          </span>
        </button>
        <div className={`panel top-card free ${s && s.freeRemain < 0 ? 'neg' : ''}`}>
          <span className="tc-label">自由枠 残り</span>
          <strong className="tc-value">{s ? yen(s.freeRemain) : '—'}</strong>
          {s && <span className="tc-sub">/ {yen(s.freeTotal)}</span>}
          <span className="tc-days">
            <span>{elapsed} / {range.days} 日目</span>
            <span className="day-bar"><i style={{ width: `${pace * 100}%` }} /></span>
          </span>
        </div>
        <div className="top-rem">
          <NextReminder variant="card" />
        </div>
      </section>

      {/* 2 段目 */}
      {budgets.length > 0 && (
        <section className="budgets" aria-label="予算枠">
          {budgets.map((b) => (
            <BudgetCard key={b.key} label={b.label} used={b.used} limit={b.limit} pace={b.paced && isCurrent ? pace : undefined} />
          ))}
        </section>
      )}

      {/* 3 段目 */}
      <section className="dash-mid">
        <div className="panel">
          <div className="panel-head">
            <h2>固定費 引き落とし状況</h2>
            <a className="link" href="#/fixed">固定費画面 →</a>
          </div>
          <FixedChecklist mode="check" />
        </div>
        <div className="panel history">
          <div className="panel-head">
            <h2>取引履歴 (固定費以外)</h2>
            <a className="link" href="#/list">すべて →</a>
          </div>
          {history.length === 0 ? (
            <Empty>この期間の取引はまだありません</Empty>
          ) : (
            <ul className="tx-list compact history-list">
              {history.map((r) => (
                <li key={r.key} onClick={() => r.txId && go('entry', r.txId)} className={r.txId ? '' : 'transfer'}>
                  <i style={{ background: r.color }} />
                  <time>{fmtMD(r.date)}</time>
                  <span className="tx-main">{r.label}<small>{r.sub}</small></span>
                  <strong className={r.income ? 'plus' : r.txId ? '' : 'muted'}>{r.income ? '+' : ''}{yen(r.amount)}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* その下 */}
      <section className="dash-bottom">
        <div className="panel">
          <h2>お知らせ</h2>
          {alerts.length === 0 ? <p className="alert ok">警告はありません</p> : alerts.map((a, i) => (
            <p key={i} className={`alert ${a.tone}`}><span aria-hidden>{a.tone === 'danger' ? '●' : '▲'}</span> {a.text}</p>
          ))}
          <FixedNotices ym={ym} title="今期の固定費" compact />
          <FixedNotices ym={shiftYM(ym, 1)} title="来期の固定費" compact />
        </div>
        <div className="panel">
          <h2>日別支出</h2>
          <DailyChart data={dailyByCategory(range, txs)} start={range.start} today={today} />
        </div>
      </section>

      <ReminderPanel />

      <a className="fab" href="#/entry" aria-label="支出を追加">＋</a>
    </div>
  );
}
