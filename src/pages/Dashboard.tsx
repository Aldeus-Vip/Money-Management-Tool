import { BudgetCard } from '../components/BudgetCard';
import { DailyChart } from '../components/DailyChart';
import { RingGauge } from '../components/RingGauge';
import { elapsedDays, type Period, yen } from '../lib/period';
import { sample } from '../mock/sampleData';

interface Props {
  period: Period;
  today: Date;
}

export function Dashboard({ period, today }: Props) {
  const elapsed = elapsedDays(period, today);
  const pace = elapsed / period.days;
  const free = sample.freeFrame;
  const freeRemain = free - sample.freeUsed;
  const freeRatio = freeRemain / free;

  const cash = sample.wallets.find((w) => w.name === '現金');
  const unknown = cash?.actual !== undefined ? cash.calc - cash.actual : 0;

  const alerts = [
    ...sample.budgets
      .filter((b) => b.used / b.limit >= 0.85)
      .map((b) => ({ tone: 'warn', text: `${b.label}の残りが ${yen(b.limit - b.used)} です` })),
    ...sample.budgets
      .filter((b) => b.paced && b.used / b.limit > pace && b.used / b.limit < 0.85)
      .map((b) => ({ tone: 'warn', text: `${b.label}が理想ペースを ${yen(b.used - b.limit * pace)} 上回っています` })),
    ...(unknown !== 0 ? [{ tone: 'danger', text: `現金に不明金 ${yen(unknown)} があります` }] : []),
  ];

  return (
    <div className="dash">
      <section className="panel hero">
        <RingGauge
          ratio={freeRatio}
          label="自由枠 残り"
          value={yen(freeRemain)}
          sub={`/ ${yen(free)}`}
          tone={freeRatio < 0 ? 'danger' : freeRatio < 0.2 ? 'warn' : 'ok'}
        />
        <div className="hero-side">
          <div className="day-count">
            <span className="big">{elapsed}</span>
            <span>/ {period.days} 日目</span>
          </div>
          <div className="day-bar">
            <div style={{ width: `${pace * 100}%` }} />
          </div>
          <dl className="hero-stats">
            <div>
              <dt>給料</dt>
              <dd>{yen(sample.salary)}</dd>
            </div>
            <div>
              <dt>固定費</dt>
              <dd>
                {yen(sample.fixedTotal)}
                <small>
                  {sample.fixedPaid}/{sample.fixedCount} 引落済
                </small>
              </dd>
            </div>
            <div>
              <dt>食費予算</dt>
              <dd>{yen(sample.foodBudget)}</dd>
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
        {sample.budgets.map((b) => (
          <BudgetCard key={b.key} label={b.label} used={b.used} limit={b.limit} pace={b.paced ? pace : undefined} />
        ))}
      </section>

      <section className="panel wallets">
        <h2>残高</h2>
        <ul>
          {sample.wallets.map((w) => (
            <li key={w.name}>
              <span className="w-name">{w.name}</span>
              <span className="w-amt">{yen(w.calc)}</span>
              {w.actual !== undefined && w.actual !== w.calc && (
                <span className="w-diff">実残高 {yen(w.actual)} / 差 {yen(w.calc - w.actual)}</span>
              )}
              {w.note && <span className="w-note">{w.note}</span>}
            </li>
          ))}
        </ul>
        <h2 className="sub">プール</h2>
        <ul>
          {sample.pools.map((p) => (
            <li key={p.name}>
              <span className="w-name">{p.name}</span>
              <span className="w-amt">{yen(p.balance)}</span>
              <span className="w-note">今期 +{yen(p.moved)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel upcoming">
        <h2>固定費 引落予定</h2>
        <ol>
          {sample.upcomingFixed.map((f) => (
            <li key={f.name}>
              <time>{f.date}</time>
              <span>{f.name}</span>
              <strong>{yen(f.amount)}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel daily">
        <h2>日別支出</h2>
        <DailyChart data={sample.daily} totalDays={period.days} startDate={period.start} />
      </section>

      <button className="fab" aria-label="支出を追加">＋</button>
    </div>
  );
}
