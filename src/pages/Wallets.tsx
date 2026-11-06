import { CommitAmount } from '../components/CommitAmount';
import { TransferForm } from '../components/TransferForm';
import { Empty, PageHead } from '../components/ui';
import * as repo from '../db/repo';
import { carryCandidates, type WalletBalance } from '../lib/balances';
import { fmtMD, fmtYM, shiftYM } from '../lib/date';
import { yen } from '../lib/period';
import { useApp, useQuery } from '../state/AppContext';
import { loadPeriod } from '../state/loadPeriod';
import { go } from '../state/router';
import { usePeriodData } from '../state/usePeriodData';
import { VIcon } from '../components/VIcon';
import { walletVisual } from '../lib/visuals';

export function Wallets() {
  const { ym, mutate, toast } = useApp();
  const { range, balances, transfers, period } = usePeriodData();
  const prev = useQuery((db) => loadPeriod(db, shiftYM(ym, -1)).balances, [ym]);
  const rows = balances.filter((b) => !b.merged);
  const bank = balances.find((b) => b.wallet.kind === 'bank');
  const debit = balances.find((b) => b.merged);

  const carry = () => {
    const c = carryCandidates(prev);
    if (rows.some((r) => r.opening !== 0) && !confirm('入力済みの期首残高を上書きします。よろしいですか?')) return;
    mutate((db) => {
      for (const r of rows) repo.setOpening(db, ym, r.wallet.id, c.get(r.wallet.id) ?? 0);
    });
    toast(`${fmtYM(shiftYM(ym, -1))} の残高を期首に設定しました`);
  };

  return (
    <div className="page">
      <PageHead title={`口座・残高 — ${fmtYM(ym)}`}>
        <button className="btn primary" onClick={() => go('entry')}>入力・照合へ</button>
        <button className="btn" onClick={carry}>前期間の残高を引き継ぐ</button>
      </PageHead>

      <section className="panel">
        <h2>残高</h2>
        <div className="table-wrap">
          <table className="table balances">
            <thead>
              <tr>
                <th>ウォレット</th>
                <th className="r col-now">現在の残高 (計算)</th>
                <th>実際の金額 (入力)</th>
                <th className="r">差</th>
                <th>期首 (給料前)</th>
                <th className="r">期間中の増減</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.wallet.id}>
                  <td className="w-title"><VIcon v={walletVisual(b.wallet)} />{b.wallet.name}</td>
                  <td className="num col-now" data-label="現在の残高 (計算)">
                    {yen(b.current)}
                    {b.fixedUnpaid > 0 && <small>固定費引落後の見込み {yen(b.projected)}</small>}
                  </td>
                  <td data-label="実際の金額 (入力)"><CommitAmount value={b.actual} allowEmpty onCommit={(v) => mutate((db) => repo.setActual(db, ym, b.wallet.id, v))} /></td>
                  <td className={`num ${b.unknown ? 'neg' : b.unknown === 0 ? 'ok' : ''}`} data-label="差">{b.unknown === null ? '—' : b.unknown === 0 ? '✓ 一致' : yen(b.unknown)}</td>
                  <td data-label="期首 (給料前)"><CommitAmount value={b.opening} onCommit={(v) => mutate((db) => repo.setOpening(db, ym, b.wallet.id, v ?? 0))} /></td>
                  <td className="num" data-label="期間中の増減">{delta(b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          差 = 現在の残高 − 実際の金額 (+ = 使途不明 / − = 記録漏れの収入)。差がある場合は「入力・照合」で明細を見ながら入力してください。
          {debit && ` ${debit.wallet.name}の支出は${bank?.wallet.name}に含めて計算します。`}
          「前期間の残高を引き継ぐ」は、前期間の実際の金額 (無ければ計算残高) を期首に入れます。
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
        <section className="panel">
          <h2>移動 (出金・入金・チャージ)</h2>
          <TransferForm start={range.start} end={range.end} />
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
          <p className="note">外部からの振込は、入力・照合で「普通口座 / 受取金」として登録してください。</p>
        </section>
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
