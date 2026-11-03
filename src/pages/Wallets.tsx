import { useEffect, useState } from 'react';
import { AmountInput, Empty, Field, PageHead, Segmented } from '../components/ui';
import * as repo from '../db/repo';
import { carryCandidates, type WalletBalance } from '../lib/balances';
import { fmtMD, fmtYM, shiftYM, todayISO } from '../lib/date';
import { yen } from '../lib/period';
import { useApp, useQuery } from '../state/AppContext';
import { loadPeriod } from '../state/loadPeriod';
import { usePeriodData } from '../state/usePeriodData';

/** 確定時 (フォーカスが外れた時) に保存する金額セル */
function CommitAmount({ value, onCommit, allowEmpty }: { value: number | null; onCommit: (v: number | null) => void; allowEmpty?: boolean }) {
  const [v, setV] = useState<number | null>(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="inline-amount" onBlur={() => v !== value && (v !== null || allowEmpty) && onCommit(v)}>
      <AmountInput value={v} onChange={setV} allowNegative placeholder={allowEmpty ? '未入力' : '0'} />
    </div>
  );
}

export function Wallets() {
  const { ym, mutate, toast } = useApp();
  const { range, balances, transfers, period } = usePeriodData();
  const prev = useQuery((db) => loadPeriod(db, shiftYM(ym, -1)).balances, [ym]);
  const rows = balances.filter((b) => !b.merged);
  const bank = balances.find((b) => b.wallet.kind === 'bank');
  const debit = balances.find((b) => b.merged);

  const carry = () => {
    const c = carryCandidates(prev);
    const hasOpening = rows.some((r) => r.opening !== 0);
    if (hasOpening && !confirm('入力済みの期首残高を上書きします。よろしいですか?')) return;
    mutate((db) => {
      for (const r of rows) repo.setOpening(db, ym, r.wallet.id, c.get(r.wallet.id) ?? 0);
    });
    toast(`${fmtYM(shiftYM(ym, -1))} の残高を期首に設定しました`);
  };

  return (
    <div className="page">
      <PageHead title={`口座・残高 — ${fmtYM(ym)}`}>
        <button className="btn" onClick={carry}>前期間の残高を引き継ぐ</button>
      </PageHead>

      <section className="panel">
        <h2>残高</h2>
        <div className="table-wrap">
          <table className="table balances">
            <thead>
              <tr><th>ウォレット</th><th>期首 (給料前)</th><th className="r">増減</th><th className="r">計算残高</th><th>実残高</th><th className="r">不明金</th></tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.wallet.id}>
                  <td className="w-title">{b.wallet.name}</td>
                  <td data-label="期首 (給料前)"><CommitAmount value={b.opening} onCommit={(v) => mutate((db) => repo.setOpening(db, ym, b.wallet.id, v ?? 0))} /></td>
                  <td className="num" data-label="増減">{delta(b)}</td>
                  <td className="num strong" data-label="計算残高">
                    {yen(b.current)}
                    {b.fixedUnpaid > 0 && <small>見込み {yen(b.projected)}</small>}
                  </td>
                  <td data-label="実残高"><CommitAmount value={b.actual} allowEmpty onCommit={(v) => mutate((db) => repo.setActual(db, ym, b.wallet.id, v))} /></td>
                  <td className={`num ${b.unknown ? 'neg' : ''}`} data-label="不明金">{b.unknown === null ? '—' : b.unknown === 0 ? '一致' : yen(b.unknown)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          実残高を入力すると不明金を表示します (+ = 使途不明 / − = 記録漏れの収入)。
          {debit && ` ${debit.wallet.name}の支出は${bank?.wallet.name}に含めて計算します。`}
          「前期間の残高を引き継ぐ」は実残高があればそれを、なければ計算残高を使います。
        </p>
      </section>

      <div className="grid-2">
        {bank && (
          <section className="panel calc">
            <h2>{bank.wallet.name}の内訳</h2>
            <dl>
              <Line label="期首 (給料前)" v={bank.opening} />
              <Line label="+ 給料・賞与" v={bank.income} hide={!period} />
              <Line label="− 固定費 (引落済)" v={-bank.fixedPaid} />
              <Line label="− 貯金・娯楽費へ移動" v={-bank.poolMove} />
              <Line label="+ プールからの使用" v={bank.poolUse} />
              <Line label="+ 移動 (入金)" v={bank.transferIn} />
              <Line label="− 移動 (出金・チャージ)" v={-bank.transferOut} />
              <Line label="− 支出 (口座・デビット)" v={-bank.spent} />
              <Line label="+ 受取金 (振込)" v={bank.received} />
              <Line label="現在の残高" v={bank.current} total />
              <Line label="− 固定費 (未引落)" v={-bank.fixedUnpaid} />
              <Line label="見込み残高" v={bank.projected} total />
            </dl>
          </section>
        )}
        <TransferPanel ym={ym} start={range.start} end={range.end} transfers={transfers} />
      </div>
    </div>
  );
}

function delta(b: WalletBalance) {
  const d = b.current - b.opening;
  return d === 0 ? '±0' : `${d > 0 ? '+' : ''}${yen(d)}`;
}

function Line({ label, v, total, hide }: { label: string; v: number; total?: boolean; hide?: boolean }) {
  if (hide || (!total && v === 0)) return null;
  return (
    <div className={total ? 'total' : ''}>
      <dt>{label}</dt>
      <dd className={v < 0 && total ? 'neg' : ''}>{yen(v)}</dd>
    </div>
  );
}

type Kind = 'withdraw' | 'deposit' | 'charge' | 'other';

function TransferPanel({ ym, start, end, transfers }: { ym: string; start: string; end: string; transfers: repo.Transfer[] }) {
  const { mutate, toast } = useApp();
  const wallets = useQuery((db) => repo.listWallets(db).filter((w) => w.kind !== 'debit'));
  const bank = wallets.find((w) => w.kind === 'bank');
  const cash = wallets.find((w) => w.kind === 'cash');
  const emoney = wallets.filter((w) => w.kind === 'emoney');

  const [kind, setKind] = useState<Kind>('withdraw');
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(0);
  const [amount, setAmount] = useState<number | null>(null);
  const [fee, setFee] = useState<number | null>(null);
  const [date, setDate] = useState(() => (todayISO() >= start && todayISO() <= end ? todayISO() : start));
  const [memo, setMemo] = useState('');

  useEffect(() => {
    const preset: Record<Kind, [number | undefined, number | undefined]> = {
      withdraw: [bank?.id, cash?.id],
      deposit: [cash?.id, bank?.id],
      charge: [bank?.id, emoney[0]?.id],
      other: [from || bank?.id, to || cash?.id],
    };
    const [f, t] = preset[kind];
    setFrom(f ?? 0);
    setTo(t ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, bank?.id, cash?.id]);
  useEffect(() => setDate(todayISO() >= start && todayISO() <= end ? todayISO() : start), [start, end]);

  const valid = from && to && from !== to && amount !== null && amount > 0;
  const save = () => {
    if (!valid) return;
    mutate((db) => repo.saveTransfer(db, { date, from_wallet_id: from, to_wallet_id: to, amount: amount!, fee: fee ?? 0, memo: memo.trim() || null }));
    toast(`移動 ${yen(amount!)} を登録しました`);
    setAmount(null);
    setFee(null);
    setMemo('');
  };
  const walletSelect = (v: number, set: (n: number) => void, list = wallets, label: string) => (
    <select value={v} onChange={(e) => set(Number(e.target.value))} aria-label={label}>
      {list.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
    </select>
  );

  return (
    <section className="panel">
      <h2>移動 (出金・入金・チャージ)</h2>
      <form className="form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Segmented small value={kind} onChange={setKind}
          options={[{ value: 'withdraw', label: '出金' }, { value: 'deposit', label: '入金' }, { value: 'charge', label: 'チャージ' }, { value: 'other', label: 'その他' }]} />
        <div className="row2">
          <Field label="移動元">{walletSelect(from, setFrom, kind === 'charge' ? wallets : wallets, '移動元')}</Field>
          <Field label="移動先">{walletSelect(to, setTo, kind === 'charge' ? emoney : wallets, '移動先')}</Field>
        </div>
        <div className="row2">
          <Field label="金額"><AmountInput value={amount} onChange={setAmount} /></Field>
          <Field label="手数料" hint="その他/手数料の支出として登録"><AmountInput value={fee} onChange={setFee} placeholder="なし" /></Field>
        </div>
        <div className="row2">
          <Field label="日付"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
          <Field label="メモ"><input value={memo} placeholder="任意" onChange={(e) => setMemo(e.target.value)} /></Field>
        </div>
        <div className="form-actions"><span className="spacer" /><button className="btn primary" disabled={!valid}>登録</button></div>
      </form>

      {transfers.length === 0 ? (
        <Empty>この期間の移動はありません</Empty>
      ) : (
        <ul className="tx-list compact transfers">
          {transfers.map((t) => (
            <li key={t.id}>
              <i style={{ background: 'var(--c-blue)' }} />
              <time>{fmtMD(t.date)}</time>
              <span className="tx-main">{t.from_name} → {t.to_name}<small>{[t.fee ? `手数料 ${yen(t.fee)}` : '', t.memo ?? ''].filter(Boolean).join(' · ')}</small></span>
              <strong>{yen(t.amount)}</strong>
              <button className="icon-btn small" aria-label="削除" onClick={() => confirm('この移動を削除しますか?') && mutate((db) => repo.deleteTransfer(db, t.id))}>×</button>
            </li>
          ))}
        </ul>
      )}
      <p className="note">{fmtYM(ym)} の期間内のみ表示。口座からの振込 (外部からの入金) は、取引入力で「普通口座 / 受取金」として登録してください。</p>
    </section>
  );
}
