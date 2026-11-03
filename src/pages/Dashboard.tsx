import { BudgetCard } from '../components/BudgetCard';
import { DailyChart } from '../components/DailyChart';
import { RingGauge } from '../components/RingGauge';
import { Empty } from '../components/ui';
import { dailyByCategory, withdrawDate } from '../lib/budget';
import { CATEGORY_COLOR } from '../lib/categories';
import { fmtMD, todayISO } from '../lib/date';
import { elapsedDays, yen } from '../lib/period';
import { useQuery } from '../state/AppContext';
import { usePeriodData } from '../state/usePeriodData';
import * as repo from '../db/repo';
import { useApp } from '../state/AppContext';
import { go } from '../state/router';

export function Dashboard() {
  const { ym, mutate } = useApp();
  const { range, period, txs, fixed, summary: s, balances, pools } = usePeriodData();
  const wallets = useQuery((db) => repo.listWallets(db));
  const today = todayISO();
  const elapsed = elapsedDays(range, today);
  const pace = elapsed / range.days;
  const isCurrent = today >= range.start && today <= range.end;

  const spendByWallet = wallets.map((w) => {
    const list = txs.filter((t) => t.wallet_id === w.id && t.category_code !== 'income');
    return { ...w, total: list.reduce((a, t) => a + t.amount, 0), count: list.length };
  });

  const budgets = s && period
    ? [
        { label: '食費', used: s.foodUsed, limit: period.food_budget, paced: true },
        { label: '臨時費用', used: s.extraUsed, limit: s.extraBudget, paced: true },
        { label: '課金', used: s.chargeUsed, limit: period.charge_limit, paced: false },
        { label: '娯楽費その他', used: s.funOtherUsed, limit: period.fun_limit, paced: false },
      ]
    : [];

  const alerts: { tone: 'warn' | 'danger'; text: string }[] = [];
  if (s) {
    if (s.freeFrame < 0) alerts.push({ tone: 'danger', text: `自由枠がマイナスです (${yen(s.freeFrame)})` });
    if (s.freeRemain < 0) alerts.push({ tone: 'danger', text: `自由枠の残りがマイナスです (${yen(s.freeRemain)})` });
    for (const b of budgets) {
      const remain = b.limit - b.used;
      // エラーは残りがマイナス (0 未満) のときだけ
      if (remain < 0) alerts.push({ tone: 'danger', text: `${b.label}が枠を ${yen(-remain)} 超えています` });
      else if (remain > 0 && b.used / b.limit >= 0.85) alerts.push({ tone: 'warn', text: `${b.label}の残りが ${yen(remain)} です` });
      else if (remain > 0 && b.paced && isCurrent && b.used / b.limit > pace) alerts.push({ tone: 'warn', text: `${b.label}が理想ペースを ${yen(b.used - b.limit * pace)} 上回っています` });
    }
  }

  for (const b of balances) {
    if (b.unknown) alerts.push({ tone: 'danger', text: `${b.wallet.name}に不明金 ${yen(b.unknown)} があります` });
  }
  const overdue = fixed.filter((f) => !f.paid && (withdrawDate(range, f.withdraw_day) ?? '9') < today);
  if (overdue.length) alerts.push({ tone: 'warn', text: `引落日を過ぎた未チェックの固定費: ${overdue.map((f) => f.name).join('、')}` });

  const upcoming = fixed
    .map((f) => ({ ...f, date: withdrawDate(range, f.withdraw_day) }))
    .sort((a, b) => (a.date ?? '9').localeCompare(b.date ?? '9'));

  return (
    <div className="dash">
      {!period && (
        <section className="panel notice">
          <p>この期間の<strong>給料が未登録</strong>です。月次予算で登録すると、予算と自由枠が計算されます。</p>
          <button className="btn primary" onClick={() => go('budget')}>給料を登録する</button>
        </section>
      )}

      {s && period && (
        <>
          <section className="panel hero">
            <RingGauge
              ratio={s.freeTotal > 0 ? s.freeRemain / s.freeTotal : 0}
              label="自由枠 残り"
              value={yen(s.freeRemain)}
              sub={`/ ${yen(s.freeTotal)}`}
              tone={s.freeRemain < 0 ? 'danger' : s.freeTotal > 0 && s.freeRemain / s.freeTotal < 0.2 ? 'warn' : 'ok'}
            />
            <div className="hero-side">
              <div className="day-count">
                <span className="big">{elapsed}</span>
                <span>/ {range.days} 日目</span>
              </div>
              <div className="day-bar">
                <div style={{ width: `${pace * 100}%` }} />
              </div>
              <dl className="hero-stats">
                <div>
                  <dt>収入</dt>
                  <dd>{yen(s.income)}{period.bonus_on ? <small>賞与込み</small> : null}</dd>
                </div>
                <div>
                  <dt>固定費</dt>
                  <dd>{yen(s.fixedTotal)}<small>{fixed.length} 件</small></dd>
                </div>
                <div>
                  <dt>食費予算</dt>
                  <dd>{yen(period.food_budget)}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="alerts" aria-label="警告">
            {alerts.length === 0 ? (
              <p className="alert ok">警告はありません</p>
            ) : (
              alerts.map((a, i) => (
                <p key={i} className={`alert ${a.tone}`}>
                  <span aria-hidden>{a.tone === 'danger' ? '●' : '▲'}</span> {a.text}
                </p>
              ))
            )}
          </section>

          <section className="budgets" aria-label="予算枠">
            {budgets.map((b) => (
              <BudgetCard key={b.label} label={b.label} used={b.used} limit={b.limit} pace={b.paced && isCurrent ? pace : undefined} />
            ))}
          </section>
        </>
      )}

      <section className="panel daily">
        <h2>日別支出</h2>
        <DailyChart data={dailyByCategory(range, txs)} start={range.start} today={today} />
      </section>

      <section className="panel upcoming">
        <h2>固定費 引落予定</h2>
        {upcoming.length === 0 ? (
          <Empty>固定費が未設定です</Empty>
        ) : (
          <ol>
            {upcoming.map((f) => (
              <li key={f.fixed_cost_id} className={`${f.paid ? 'past' : ''} ${!f.paid && f.date && f.date < today ? 'overdue' : ''}`}>
                <input type="checkbox" checked={!!f.paid} aria-label={`${f.name} 引落済`} onChange={(e) => mutate((db) => repo.setFixedPaid(db, ym, f.fixed_cost_id, e.target.checked))} />
                <time>{f.date ? fmtMD(f.date) : '—'}</time>
                <span>{f.name}</span>
                <strong>{yen(f.actual)}</strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="panel wallets">
        <h2>残高</h2>
        <ul>
          {balances.map((b) => {
            const spend = spendByWallet.find((w) => w.id === b.wallet.id);
            return (
              <li key={b.wallet.id} onClick={() => go('wallets')}>
                <span className="w-name">{b.wallet.name}</span>
                <span className="w-amt">{b.merged ? `−${yen(spend?.total ?? 0)}` : yen(b.current)}</span>
                {b.merged && <span className="w-note">今期の支出 {spend?.count ?? 0} 件 (口座から引落)</span>}
                {!b.merged && b.fixedUnpaid > 0 && <span className="w-note">固定費引落後の見込み {yen(b.projected)}</span>}
                {b.unknown ? <span className="w-diff">実残高 {yen(b.actual ?? 0)} / 不明金 {yen(b.unknown)}</span> : null}
              </li>
            );
          })}
        </ul>
        <h2 className="sub">プール</h2>
        <ul>
          {pools.map((p) => (
            <li key={p.id} onClick={() => go('pools')}>
              <span className="w-name">{p.name}</span>
              <span className="w-amt">{yen(p.balance)}</span>
              <span className="w-note">今期 +{yen(p.moved)}{p.used ? ` / 使用 −${yen(p.used)}` : ''}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel recent">
        <h2>最近の取引</h2>
        {txs.length === 0 ? (
          <Empty>この期間の取引はまだありません</Empty>
        ) : (
          <ul className="tx-list compact">
            {txs.slice(0, 6).map((t) => (
              <li key={t.id} onClick={() => go('entry', t.id)}>
                <i style={{ background: CATEGORY_COLOR[t.category_code] }} />
                <time>{fmtMD(t.date)}</time>
                <span className="tx-main">{t.purpose_name ?? t.category_name}<small>{t.wallet_name}</small></span>
                <strong className={t.category_code === 'income' ? 'plus' : ''}>{t.category_code === 'income' ? '+' : ''}{yen(t.amount)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <a className="fab" href="#/entry" aria-label="支出を追加">＋</a>
    </div>
  );
}
