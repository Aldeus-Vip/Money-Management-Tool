import { useEffect, useState } from 'react';
import { SourceAmount, SourceLegend } from '../components/SourceAmount';
import { AmountInput, Empty, Field, PageHead } from '../components/ui';
import * as repo from '../db/repo';
import type { PeriodInput } from '../db/repo';
import { summarize } from '../lib/budget';
import { fmtMD, fmtYM, shiftYM } from '../lib/date';
import { paydayOf, yen } from '../lib/period';
import { useApp, useQuery } from '../state/AppContext';
import { usePeriodData } from '../state/usePeriodData';

type NumKey = Exclude<keyof PeriodInput, 'start_date' | 'memo' | 'bonus_on'>;

export function Budget() {
  const { mutate, toast, ym } = useApp();
  const { range, period, txs, fixed, fixedTotal, rec, settings, poolUse, carry, openingTotal } = usePeriodData();
  const prev = useQuery((db) => repo.getPeriod(db, shiftYM(ym, -1)), [ym]);
  const masters = useQuery((db) => repo.listFixedCosts(db, true));

  const initial = (): PeriodInput =>
    period ?? {
      start_date: paydayOf(ym, repo.paydayRule(settings)),
      salary: prev?.salary ?? 0,
      bonus: 0,
      bonus_on: 0,
      food_budget: rec.food ?? prev?.food_budget ?? 0,
      charge_limit: prev?.charge_limit ?? 0,
      fun_limit: prev?.fun_limit ?? 0,
      saving_move: prev?.saving_move ?? 0,
      fun_move: prev?.fun_move ?? 0,
      extra_add: 0,
    };
  const [form, setForm] = useState<PeriodInput>(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setForm(initial()), [ym, !!period]);

  const num = (k: NumKey) => (v: number | null) => setForm((f) => ({ ...f, [k]: v ?? 0 }));
  const dirty = period && JSON.stringify({ ...period, ym: undefined }) !== JSON.stringify({ ...period, ...form, ym: undefined });

  const submit = () => {
    if (period) {
      mutate((db) => repo.savePeriod(db, ym, form));
      toast('予算を保存しました');
    } else {
      mutate((db) => repo.startPeriod(db, ym, form));
      toast(`${fmtYM(ym)} の期間を開始しました`);
    }
  };

  // 未保存の入力値でプレビュー
  const preview = summarize({ ym, memo: null, ...form }, txs, period ? fixedTotal : masters.reduce((s, f) => s + f.default_amount, 0), { poolUse, carry });
  const notInPeriod = masters.filter((m) => !fixed.some((f) => f.fixed_cost_id === m.id));

  return (
    <div className="page">
      <PageHead title={`月次予算 — ${fmtYM(ym)}`}>
        <span className="muted">
          {fmtMD(range.start)} 〜 {fmtMD(range.end)} ({range.days}日)
        </span>
      </PageHead>

      <div className="grid-2">
        <form
          className="panel form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h2>{period ? '収入と配分' : '給料を登録して期間を開始'}</h2>
          <div className="row2">
            <Field label="給料日 (期間の開始日)" hint="実際の振込日が違う場合は修正">
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
            </Field>
            <Field label="今月の給料">
              <AmountInput value={form.salary} onChange={num('salary')} />
            </Field>
          </div>
          <div className="row2">
            <Field label="賞与">
              <AmountInput value={form.bonus} onChange={num('bonus')} />
            </Field>
            <Field label="賞与を予算に含める">
              <label className="switch">
                <input type="checkbox" checked={!!form.bonus_on} onChange={(e) => setForm({ ...form, bonus_on: e.target.checked ? 1 : 0 })} />
                <span>{form.bonus_on ? 'ON' : 'OFF'}</span>
              </label>
            </Field>
          </div>
          <Field label="食費予算" group hint={rec.food !== null ? <>推奨 {yen(rec.food)} (過去平均 × {settings.avgRate}) <button type="button" className="link" onClick={() => num('food_budget')(rec.food)}>適用</button></> : '履歴がたまると推奨値を表示します'}>
            <AmountInput value={form.food_budget} onChange={num('food_budget')} />
          </Field>
          <div className="row2">
            <Field label="課金 上限">
              <AmountInput value={form.charge_limit} onChange={num('charge_limit')} />
            </Field>
            <Field label="娯楽費その他 上限">
              <AmountInput value={form.fun_limit} onChange={num('fun_limit')} />
            </Field>
          </div>
          <div className="row2">
            <Field label="貯金へ移動">
              <AmountInput value={form.saving_move} onChange={num('saving_move')} />
            </Field>
            <Field label="娯楽費へ移動">
              <AmountInput value={form.fun_move} onChange={num('fun_move')} />
            </Field>
          </div>
          <Field label="その他加算 (暫定)" hint="繰越などのルールは後日決定。それまでは必要に応じて手入力">
            <AmountInput value={form.extra_add} onChange={num('extra_add')} allowNegative />
          </Field>
          <div className="form-actions">
            {period && (
              <button
                type="button"
                className="btn danger ghost"
                onClick={() => {
                  if (!confirm('この期間の予算と固定費の設定を削除しますか? (取引は残ります)')) return;
                  mutate((db) => repo.deletePeriod(db, ym));
                  toast('期間を削除しました', 'warn');
                }}
              >
                期間を削除
              </button>
            )}
            <span className="spacer" />
            <button className="btn primary" disabled={!!period && !dirty}>
              {period ? '保存' : '期間を開始'}
            </button>
          </div>
        </form>

        <div className="stack">
          <section className="panel calc">
            <h2>計算の流れ {period && dirty && <em className="muted">(未保存の値でプレビュー)</em>}</h2>
            <dl>
              <Row label="収入" v={preview.income} />
              <Row label="− 固定費" v={-preview.fixedTotal} />
              <Row label="固定費支払後" v={preview.afterFixed} total />
              <Row label="− 食費予算" v={-form.food_budget} />
              <Row label="自由枠" v={preview.freeFrame} total />
              <Row label="+ 受取金" v={preview.received} />
              {preview.poolUse !== 0 && <Row label="+ プールからの使用" v={preview.poolUse} />}
              {settings.carryOpening && <Row label="+ 期首残高 (繰越)" v={preview.carry} />}
              {form.extra_add !== 0 && <Row label="+ その他加算" v={form.extra_add} />}
              <Row label="自由枠 合計" v={preview.freeTotal} total />
              <Row label="− 課金・娯楽費 上限" v={-(form.charge_limit + form.fun_limit)} />
              <Row label="− 貯金・娯楽費 移動" v={-(form.saving_move + form.fun_move)} />
              <Row label="臨時費用 枠" v={preview.extraBudget} total />
            </dl>
            {rec.extra !== null && (
              <p className={`note ${preview.extraBudget < rec.extra ? 'warn' : ''}`}>
                臨時費用の推奨最低額 {yen(rec.extra)} (過去平均 × {settings.avgRate} + {yen(settings.extraMin)})
                {preview.extraBudget < rec.extra && ' を下回っています'}
              </p>
            )}
            {!period && <p className="note">固定費はマスタの既定額で仮計算しています。</p>}
            {!settings.carryOpening && openingTotal !== 0 && (
              <p className="note">参考: 期首残高の合計 {yen(openingTotal)} (Excel ではこれを自由枠に加算。設定で切替可・繰越ルールは相談中)</p>
            )}
          </section>

          {period && (
            <section className="panel">
              <h2>この期間の固定費 (予算額) <span className="muted">{yen(fixedTotal)}</span> <a className="link" href="#/fixed">引落額を入力 →</a></h2>
              {fixed.length === 0 ? (
                <Empty>固定費がありません。マスタ管理で登録できます。</Empty>
              ) : (
                <>
                  <SourceLegend />
                  <ul className="fixed-list">
                    {fixed.map((f) => (
                      <li key={f.fixed_cost_id}>
                        <span className="day">{f.withdraw_day ? `${f.withdraw_day}日` : '—'}</span>
                        <span className="name">{f.name}<small>引落 {yen(f.actual)}{f.paid ? ' (済)' : ''}</small></span>
                        <SourceAmount label={`${f.name}の予算額`} input={f.planned_input} auto={f.auto} onSet={(v) => mutate((db) => repo.setPlanned(db, ym, f.fixed_cost_id, v))} />
                        <button className="icon-btn small" aria-label={`${f.name}をこの期間から外す`} onClick={() => mutate((db) => repo.removeFixedFromPeriod(db, ym, f.fixed_cost_id))}>
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {notInPeriod.length > 0 && (
                <select
                  value=""
                  aria-label="固定費を追加"
                  onChange={(e) => {
                    const m = masters.find((x) => x.id === Number(e.target.value));
                    if (m) mutate((db) => repo.addFixedToPeriod(db, ym, m));
                  }}
                >
                  <option value="">＋ 固定費を追加…</option>
                  {notInPeriod.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              )}
              <p className="note">ここは予算額 (自由枠の計算用)。引落額と引落済は「固定費」画面で入力します。自動額は、マスタが固定額ならその金額、過去平均なら直近12期間の引落額の平均 (バッファ対象は +{Math.round(settings.bufferRate * 100)}%)。</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, v, total }: { label: string; v: number; total?: boolean }) {
  return (
    <div className={total ? 'total' : ''}>
      <dt>{label}</dt>
      <dd className={v < 0 && total ? 'neg' : ''}>{yen(v)}</dd>
    </div>
  );
}
