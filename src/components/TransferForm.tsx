import { useEffect, useState } from 'react';
import { AmountInput, Field, Segmented } from './ui';
import * as repo from '../db/repo';
import { todayISO } from '../lib/date';
import { yen } from '../lib/period';
import { useApp, useQuery } from '../state/AppContext';

type Kind = 'withdraw' | 'deposit' | 'charge' | 'other';

/** 移動 (出金・入金・チャージ) の入力フォーム。登録後に onSaved(移動ID) */
export function TransferForm({ start, end, onSaved }: { start: string; end: string; onSaved?: (id: number) => void }) {
  const { mutate, toast } = useApp();
  const wallets = useQuery((db) => repo.listWallets(db).filter((w) => w.kind !== 'debit'));
  const bank = wallets.find((w) => w.kind === 'bank');
  const cash = wallets.find((w) => w.kind === 'cash');
  const emoney = wallets.filter((w) => w.kind === 'emoney');
  const inPeriod = () => (todayISO() >= start && todayISO() <= end ? todayISO() : start);

  const [kind, setKind] = useState<Kind>('withdraw');
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(0);
  const [amount, setAmount] = useState<number | null>(null);
  const [fee, setFee] = useState<number | null>(null);
  const [date, setDate] = useState(inPeriod);
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
  useEffect(() => setDate(inPeriod()), [start, end]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid = from && to && from !== to && amount !== null && amount > 0;
  const save = () => {
    if (!valid) return;
    const id = mutate((db) => repo.saveTransfer(db, { date, from_wallet_id: from, to_wallet_id: to, amount: amount!, fee: fee ?? 0, memo: memo.trim() || null }));
    toast(`移動 ${yen(amount!)} を登録しました`);
    setAmount(null);
    setFee(null);
    setMemo('');
    onSaved?.(id);
  };
  const select = (v: number, set: (n: number) => void, list: repo.Wallet[], label: string) => (
    <select value={v} onChange={(e) => set(Number(e.target.value))} aria-label={label}>
      {list.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
    </select>
  );

  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <Segmented small value={kind} onChange={setKind}
        options={[{ value: 'withdraw', label: '出金 (口座→現金)' }, { value: 'deposit', label: '入金 (現金→口座)' }, { value: 'charge', label: 'チャージ' }, { value: 'other', label: 'その他' }]} />
      <div className="row2">
        <Field label="移動元">{select(from, setFrom, wallets, '移動元')}</Field>
        <Field label="移動先">{select(to, setTo, kind === 'charge' ? emoney : wallets, '移動先')}</Field>
      </div>
      <div className="row2">
        <Field label="金額"><AmountInput value={amount} onChange={setAmount} /></Field>
        <Field label="手数料" hint="その他/手数料の支出として登録"><AmountInput value={fee} onChange={setFee} placeholder="なし" /></Field>
      </div>
      <div className="row2">
        <Field label="日付"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="メモ"><input value={memo} placeholder="任意" onChange={(e) => setMemo(e.target.value)} /></Field>
      </div>
      <div className="form-actions"><span className="spacer" /><button className="btn primary" disabled={!valid}>移動を登録</button></div>
    </form>
  );
}
