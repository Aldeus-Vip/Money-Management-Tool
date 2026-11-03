import { useEffect, useState } from 'react';
import { AmountInput, Empty, Field, PageHead, Segmented } from '../components/ui';
import { DateInput } from '../components/DateInput';
import * as repo from '../db/repo';
import { fmtMD, fmtYM, todayISO } from '../lib/date';
import { yen } from '../lib/period';
import { useApp, useQuery } from '../state/AppContext';
import { usePeriodData } from '../state/usePeriodData';

const USE_PURPOSES = ['臨時費用補填', '課金', '娯楽', 'その他'];

export function Pools() {
  const { ym, mutate, toast } = useApp();
  const { range, pools } = usePeriodData();
  const entries = useQuery((db) => repo.listPoolEntries(db, range.start, range.end), [range.start, range.end]);
  const inPeriod = (d: string) => (d >= range.start && d <= range.end ? d : range.start);

  const [mode, setMode] = useState<'use' | 'adjust'>('use');
  const [poolId, setPoolId] = useState(0);
  const [amount, setAmount] = useState<number | null>(null);
  const [purpose, setPurpose] = useState(USE_PURPOSES[0]);
  const [date, setDate] = useState(inPeriod(todayISO()));
  const [memo, setMemo] = useState('');
  useEffect(() => setDate(inPeriod(todayISO())), [range.start]); // eslint-disable-line react-hooks/exhaustive-deps
  const pid = poolId || pools[0]?.id;
  const target = pools.find((p) => p.id === pid);

  const valid = !!pid && amount !== null && (mode === 'adjust' || amount > 0);
  const save = () => {
    if (!valid || !target) return;
    if (mode === 'use') {
      mutate((db) => repo.savePoolEntry(db, { pool_id: pid, date, kind: 'use', amount: amount!, purpose, memo: memo.trim() || null }));
      toast(`${target.name}から ${yen(amount!)} を使用しました`);
    } else {
      // 「実際の残高」を入力 → 差額を調整として記録
      const diff = amount! - target.balance;
      if (diff === 0) return toast('残高は一致しています');
      mutate((db) => repo.savePoolEntry(db, { pool_id: pid, date, kind: 'adjust', amount: diff, purpose: '残高調整', memo: memo.trim() || null }));
      toast(`${target.name}の残高を ${yen(amount!)} に合わせました`);
    }
    setAmount(null);
    setMemo('');
  };

  return (
    <div className="page">
      <PageHead title={`貯蓄・プール — ${fmtYM(ym)}`} />

      <section className="stat-row">
        {pools.map((p) => (
          <div key={p.id} className="panel stat pool">
            <span>{p.name}</span>
            <strong>{yen(p.balance)}</strong>
            <small>今期 移動 +{yen(p.moved)} / 使用 −{yen(p.used)}</small>
          </div>
        ))}
      </section>

      <div className="grid-2">
        <form className="panel form" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <h2>記録</h2>
          <Segmented small value={mode} onChange={setMode} options={[{ value: 'use', label: 'プールから使う' }, { value: 'adjust', label: '残高を合わせる' }]} />
          <Field label="プール" group>
            <Segmented value={pid ?? 0} onChange={setPoolId} options={pools.map((p) => ({ value: p.id, label: p.name }))} />
          </Field>
          <Field label={mode === 'use' ? '使う金額' : '実際の残高'} hint={mode === 'adjust' && target ? `現在の計算残高 ${yen(target.balance)}。差額を調整として記録します (初期残高の設定にも使用)` : '口座に戻り、この期間の自由枠に加算されます'}>
            <AmountInput value={amount} onChange={setAmount} />
          </Field>
          {mode === 'use' && (
            <Field label="用途" group>
              <div className="chips">
                {USE_PURPOSES.map((u) => (
                  <button key={u} type="button" className={`chip-btn ${purpose === u ? 'on' : ''}`} onClick={() => setPurpose(u)}>{u}</button>
                ))}
              </div>
            </Field>
          )}
          <div className="row2">
            <Field label="日付" group><DateInput value={date} onChange={setDate} /></Field>
            <Field label="メモ"><input value={memo} placeholder="任意" onChange={(e) => setMemo(e.target.value)} /></Field>
          </div>
          <div className="form-actions"><span className="spacer" /><button className="btn primary" disabled={!valid}>記録</button></div>
        </form>

        <section className="panel">
          <h2>この期間の記録</h2>
          {entries.length === 0 ? (
            <Empty>記録はありません</Empty>
          ) : (
            <ul className="tx-list compact">
              {entries.map((e) => (
                <li key={e.id}>
                  <i style={{ background: e.kind === 'use' ? 'var(--c-amber)' : 'var(--c-silver-dim)' }} />
                  <time>{fmtMD(e.date)}</time>
                  <span className="tx-main">{e.pool_name} · {e.purpose ?? (e.kind === 'use' ? '使用' : '調整')}<small>{e.memo}</small></span>
                  <strong className={e.kind === 'use' ? '' : e.amount >= 0 ? 'plus' : 'neg'}>{e.kind === 'use' ? '−' : e.amount >= 0 ? '+' : ''}{yen(e.kind === 'use' ? e.amount : e.amount)}</strong>
                  <button className="icon-btn small" aria-label="削除" onClick={() => confirm('この記録を削除しますか?') && mutate((db) => repo.deletePoolEntry(db, e.id))}>×</button>
                </li>
              ))}
            </ul>
          )}
          <p className="note">残高 = 調整 + 各期間の移動額 (月次予算の「貯金へ移動」「娯楽費へ移動」) − 使用。</p>
        </section>
      </div>
    </div>
  );
}
