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
import { listWallets } from '../db/repo';
import { go } from '../state/router';

export function Dashboard() {
  const { range, period, txs, fixed, summary: s } = usePeriodData();
  const wallets = useQuery((db) => listWallets(db));
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
      if (b.limit <= 0 && b.used <= 0) continue;
      const r = b.limit > 0 ? b.used / b.limit : Infinity;
      if (r >= 1) alerts.push({ tone: 'danger', text: `${b.label}が枠を ${yen(b.used - b.limit)} 超えています` });
      else if (r >= 0.85) alerts.push({ tone: 'warn', text: `${b.label}の残りが ${yen(b.limit - b.used)} です` });
      else if (b.paced && isCurrent && r > pace) alerts.push({ tone: 'warn', text: `${b.label}が理想ペースを ${yen(b.used - b.limit * pace)} 上回っています` });
    }
  }

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
              <li key={f.fixed_cost_id} className={f.date && f.date < today ? 'past' : ''}>
                <time>{f.date ? fmtMD(f.date) : '—'}</time>
                <span>{f.name}</span>
                <strong>{yen(f.amount)}</strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="panel wallets">
        <h2>ウォレット別 支出</h2>
        <ul>
          {spendByWallet.map((w) => (
            <li key={w.id}>
              <span className="w-name">{w.name}</span>
              <span className="w-amt">{yen(w.total)}</span>
              <span className="w-note">{w.count} 件</span>
            </li>
          ))}
        </ul>
        <p className="note">残高・不明金チェックは Phase 2 で追加予定</p>
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
