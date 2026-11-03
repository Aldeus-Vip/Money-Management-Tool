import { useState } from 'react';
import { PaceChart } from '../components/PaceChart';
import { Empty, PageHead } from '../components/ui';
import * as repo from '../db/repo';
import { average, ITEM_GROUPS, periodItems } from '../lib/actuals';
import { dailyByCategory } from '../lib/budget';
import { fmtYM, parseYM, todayISO, ym as toYm, type YM } from '../lib/date';
import { yen } from '../lib/period';
import { useApp, useQuery } from '../state/AppContext';
import { loadPeriod } from '../state/loadPeriod';
import { usePeriodData } from '../state/usePeriodData';

const fmtNum = (v: number | null | undefined) => (v === null || v === undefined ? '' : Math.round(v).toLocaleString('ja-JP'));

export function Analysis() {
  const { ym } = useApp();
  const { range, period, txs, summary } = usePeriodData();
  const [year, setYear] = useState(parseYM(ym).year);
  const today = todayISO();
  const daily = dailyByCategory(range, txs);

  const table = useQuery((db) => {
    const build = (y: number) => {
      const months: YM[] = Array.from({ length: 12 }, (_, i) => toYm(y, i + 1));
      const imported = repo.listMonthlyActuals(db, months[0], months[11]);
      const nowYm = repo.ymForDate(db, todayISO());
      return months.map((k) => {
        const m = repo.getPeriod(db, k) ? periodItems(loadPeriod(db, k)) : new Map<string, number>();
        let source: 'app' | 'import' | 'plan' | 'none' = m.size ? 'app' : imported.some((a) => a.ym === k) ? 'import' : 'none';
        if (!m.size) for (const a of imported.filter((x) => x.ym === k)) m.set(a.item, a.amount);
        if (source === 'none' && k >= nowYm) {
          // これからの月: マスタの請求月・予定から固定費の見込み (閲覧のみ)
          const proj = repo.projectedFixed(db, k);
          for (const f of proj) m.set(`fixed:${f.name}`, f.amount);
          m.set('fixed:total', proj.reduce((a, f) => a + f.amount, 0));
          source = 'plan';
        }
        return { ym: k, values: m, source };
      });
    };
    const cur = build(year);
    const prev = build(year - 1);
    const fixedKeys = [...new Set([...cur, ...prev].flatMap((c) => [...c.values.keys()].filter((k) => k.startsWith('fixed:') && k !== 'fixed:total')))].sort();
    return { cur, prev, fixedKeys };
  }, [year]);

  const groups = [
    ITEM_GROUPS[0],
    { title: '固定費', items: [...table.fixedKeys.map((k) => ({ key: k, label: k.slice(6) })), { key: 'fixed:total', label: '固定費 計' }] },
    ...ITEM_GROUPS.slice(1),
  ];
  const hasData = table.cur.some((c) => c.source !== 'none');
  const isFixedRow = (key: string) => key.startsWith('fixed:');

  return (
    <div className="page">
      <PageHead title="分析" />

      <section className="grid-2">
        {period && summary ? (
          <>
            <div className="panel"><PaceChart title="食費" budget={period.food_budget} daily={daily.map((d) => d.food)} start={range.start} today={today} color="#19e3e8" /></div>
            <div className="panel"><PaceChart title="臨時費用" budget={summary.extraBudget} daily={daily.map((d) => d.transport + d.extra + d.other)} start={range.start} today={today} color="#f5b83d" /></div>
          </>
        ) : (
          <div className="panel"><Empty>{fmtYM(ym)} は給料が未登録のため、ペースを表示できません</Empty></div>
        )}
      </section>

      <section className="panel">
        <div className="table-head">
          <h2>費用実績</h2>
          <div className="period">
            <button aria-label="前の年" onClick={() => setYear(year - 1)}>◀</button>
            <strong>{year}</strong>
            <button aria-label="次の年" onClick={() => setYear(year + 1)}>▶</button>
          </div>
        </div>
        {!hasData ? (
          <Empty>{year} 年のデータはありません</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table actuals">
              <thead>
                <tr>
                  <th />
                  {table.cur.map((c) => (
                    <th key={c.ym} className={`r ${c.ym === ym ? 'cur' : ''} ${c.source === 'plan' ? 'plan' : ''}`} title={c.source === 'import' ? '取り込んだ集計値' : c.source === 'plan' ? '固定費の見込み (マスタの請求月・予定から)' : ''}>
                      {parseYM(c.ym).month}月{c.source === 'import' && <sup>*</sup>}{c.source === 'plan' && <sup className="plan-mark">予</sup>}
                    </th>
                  ))}
                  <th className="r">平均</th>
                  <th className="r">前年平均</th>
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.title}>
                  <tr className="group"><th colSpan={15}>{g.title}</th></tr>
                  {g.items.map((it) => {
                    // 見込みの列は固定費の行だけ表示し、平均には含めない
                    const vals = table.cur.map((c) => (c.source === 'none' || (c.source === 'plan' && !isFixedRow(it.key)) ? undefined : c.values.get(it.key) ?? 0));
                    const avgVals = vals.map((v, i) => (table.cur[i].source === 'plan' ? undefined : v));
                    const prevVals = table.prev.map((c) => (c.source === 'none' ? undefined : c.values.get(it.key) ?? 0));
                    return (
                      <tr key={it.key} className={it.key === 'fixed:total' || it.key === 'free:remain' ? 'sum' : ''}>
                        <th>{it.label}</th>
                        {vals.map((v, i) => <td key={i} className={`num ${table.cur[i].ym === ym ? 'cur' : ''} ${table.cur[i].source === 'plan' ? 'plan' : ''} ${v !== undefined && v < 0 ? 'neg' : ''}`}>{fmtNum(v)}</td>)}
                        <td className="num avg">{fmtNum(average(avgVals))}</td>
                        <td className="num avg">{fmtNum(average(prevVals))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
        <p className="note">月 = 給料日が属する月 (期間)。* は Excel から取り込んだ集計値。「予」の列は固定費の見込み (マスタの請求月・予定から。編集はマスタ管理で、平均には含めない)。平均はデータのある月のみ。{summary && ` 今期の自由枠残り ${yen(summary.freeRemain)}`}</p>
      </section>
    </div>
  );
}
