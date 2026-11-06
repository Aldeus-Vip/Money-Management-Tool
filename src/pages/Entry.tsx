import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CommitAmount } from '../components/CommitAmount';
import { TransferForm } from '../components/TransferForm';
import { AmountInput, Field, PageHead, Segmented } from '../components/ui';
import { DateInput } from '../components/DateInput';
import { FixedChecklist } from '../components/FixedChecklist';
import * as repo from '../db/repo';
import type { CategoryCode } from '../db/repo';
import { CATEGORY_COLOR, CATEGORY_LABEL } from '../lib/categories';
import { fmtMD, fmtYM, todayISO } from '../lib/date';
import { buildLedger } from '../lib/ledger';
import { yen } from '../lib/period';
import { useApp, useQuery } from '../state/AppContext';
import { go } from '../state/router';
import { usePeriodData } from '../state/usePeriodData';

const LAST_WALLET = 'last-wallet';
const CODES: CategoryCode[] = ['food', 'transport', 'fun', 'extra', 'other', 'income'];

function lastWallet(): number | null {
  try {
    return Number(localStorage.getItem(LAST_WALLET)) || null;
  } catch {
    return null;
  }
}

/**
 * 入力・照合: 実際の残高と照合しながら 1 件ずつ入力する画面。
 * 上 = 各ウォレットの「現在 (計算)」「実際 (入力)」「差」/ 左 = 入力 / 右 = 通帳形式の明細 (行ごとの残高)
 */
/**
 * 画面に収める表示 (ページは動かさず明細だけスクロール) にするか。
 * ヘッダ (予算の帯を含む) を除いた高さが足りない画面では、ページ全体をスクロールさせる
 * (足りないのに収めると、明細が潰れて操作できなくなるため)。
 */
function useFitLayout(): boolean {
  const [fit, setFit] = useState(false);
  useLayoutEffect(() => {
    const calc = () => {
      const top = document.querySelector('.topbar')?.getBoundingClientRect().height ?? 64;
      setFit(window.innerWidth >= 1001 && window.innerHeight - top >= 560);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  return fit;
}

export function Entry({ id }: { id?: number }) {
  const { ym, mutate } = useApp();
  const fit = useFitLayout();
  const data = usePeriodData();
  const wallets = useQuery((db) => repo.listWallets(db));
  const editing = useQuery((db) => (id ? repo.getTransaction(db, id) : undefined), [id]);

  const [walletId, setWalletId] = useState<number>(() => lastWallet() ?? 0);
  const [mode, setMode] = useState<'tx' | 'transfer' | 'fixed'>('tx');
  const [fixedHl, setFixedHl] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [lastDelta, setLastDelta] = useState<{ walletId: number; delta: number } | null>(null);

  const wid = wallets.some((w) => w.id === walletId) ? walletId : wallets[0]?.id;
  useEffect(() => {
    if (editing) setWalletId(editing.wallet_id);
  }, [editing]);

  // デビットは口座の残高として照合
  const bank = data.balances.find((b) => b.wallet.kind === 'bank');
  const ledgerWalletId = wallets.find((w) => w.id === wid)?.kind === 'debit' && bank ? bank.wallet.id : wid;
  const ledger = useMemo(() => (ledgerWalletId ? buildLedger(data, ledgerWalletId) : []), [data, ledgerWalletId]);
  const ledgerBal = data.balances.find((b) => b.wallet.id === ledgerWalletId);

  const onSaved = (key: string, deltaWallet: number | null, delta: number) => {
    setFlash(key);
    setLastDelta(deltaWallet ? { walletId: deltaWallet, delta } : null);
    window.setTimeout(() => setFlash((k) => (k === key ? null : k)), 2400);
  };

  return (
    <div className={`page recon ${fit ? 'fit' : ''}`}>
      <PageHead title={`入力・照合 — ${fmtYM(ym)}`}>
        <span className="muted">実際の金額を入れて、差が 0 になるまで入力</span>
      </PageHead>

      <section className="recon-strip" aria-label="残高の照合">
        {data.balances.filter((b) => !b.merged).map((b) => {
          const selected = b.wallet.id === ledgerWalletId;
          const match = b.unknown === 0;
          return (
            <div
              key={b.wallet.id}
              className={`panel recon-card ${selected ? 'selected' : ''} ${b.unknown === null ? '' : match ? 'match' : 'diff'}`}
              onClick={() => setWalletId(b.wallet.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setWalletId(b.wallet.id)}
            >
              <div className="rc-head">
                <strong>{b.wallet.name}</strong>
                {b.unknown === null ? <span className="rc-badge">実際 未入力</span> : match ? <span className="rc-badge ok">✓ 一致</span> : <span className="rc-badge ng">差 {b.unknown > 0 ? '+' : ''}{yen(b.unknown)}</span>}
              </div>
              <div className="rc-now">
                <small>現在 (計算)</small>
                <span>{yen(b.current)}</span>
                {lastDelta?.walletId === b.wallet.id && <em className={lastDelta.delta < 0 ? 'minus' : 'plus'}>{lastDelta.delta > 0 ? '+' : ''}{yen(lastDelta.delta)}</em>}
              </div>
              <div className="rc-actual" onClick={(e) => e.stopPropagation()}>
                <small>実際の金額</small>
                <CommitAmount value={b.actual} allowEmpty onCommit={(v) => mutate((db) => repo.setActual(db, ym, b.wallet.id, v))} />
              </div>
            </div>
          );
        })}
      </section>

      <div className="recon-grid">
        <section className="panel">
          {!id && (
            <Segmented value={mode} onChange={setMode} options={[{ value: 'tx', label: '支出・受取' }, { value: 'transfer', label: '移動 (出金・チャージ)' }, { value: 'fixed', label: '固定費' }]} />
          )}
          {mode === 'fixed' && !id ? (
            <>
              <FixedChecklist mode="edit" highlight={fixedHl} />
              <p className="note">✓ = 引落済 (口座の残高から引かれ、明細に入ります)。金額は引落額。予算額の変更は月次予算・固定費画面で行います。</p>
            </>
          ) : mode === 'tx' || id ? (
            <TxForm id={id} editing={editing} walletId={wid ?? 0} setWalletId={setWalletId} start={data.range.start} end={data.range.end}
              onSaved={(txId, w, delta) => onSaved(`tx-${txId}`, w, delta)} bankId={bank?.wallet.id} />
          ) : (
            <TransferForm start={data.range.start} end={data.range.end} onSaved={(tid) => onSaved(`tr-${tid}`, null, 0)} />
          )}
        </section>

        <LedgerPanel
          title={`${ledgerBal?.wallet.name ?? ''}の明細`}
          rows={ledger}
          flash={flash}
          current={ledgerBal?.current ?? 0}
          actual={ledgerBal?.actual ?? null}
          editingId={id}
          onFixed={(fid) => { setMode('fixed'); setFixedHl(fid); }}
        />
      </div>
    </div>
  );
}

function TxForm({
  id, editing, walletId, setWalletId, start, end, onSaved, bankId,
}: {
  id?: number; editing?: repo.Transaction; walletId: number; setWalletId: (n: number) => void; start: string; end: string;
  onSaved: (txId: number, walletForDelta: number, delta: number) => void; bankId?: number;
}) {
  const { mutate, toast } = useApp();
  const wallets = useQuery((db) => repo.listWallets(db));
  const bentoPrice = useQuery((db) => repo.getSettings(db).bentoPrice);
  const inPeriod = () => (todayISO() >= start && todayISO() <= end ? todayISO() : start);
  const [date, setDate] = useState(inPeriod);
  const [category, setCategory] = useState<CategoryCode>('food');
  const [purposeText, setPurposeText] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [memo, setMemo] = useState('');
  const [days, setDays] = useState<number | ''>('');
  const amountRef = useRef<HTMLDivElement>(null);
  const purposes = useQuery((db) => repo.listPurposes(db, { walletId }), [walletId]);

  useEffect(() => {
    if (!editing) return;
    setDate(editing.date);
    setCategory(editing.category_code);
    setPurposeText(editing.purpose_name ?? '');
    setAmount(editing.amount);
    setMemo(editing.memo ?? '');
  }, [editing]);
  useEffect(() => {
    if (!id) setDate(inPeriod());
  }, [start, end]); // eslint-disable-line react-hooks/exhaustive-deps

  const chips = useMemo(() => purposes.filter((p) => !p.category_code || p.category_code === category).slice(0, 14), [purposes, category]);
  const valid = !!walletId && amount !== null && amount > 0 && !!date;
  const pickPurpose = (name: string) => {
    setPurposeText(name);
    const p = purposes.find((x) => x.name === name);
    if (p?.category_code) setCategory(p.category_code);
  };
  const focusAmount = () => amountRef.current?.querySelector('input')?.focus();

  const save = () => {
    if (!valid) return;
    const txId = mutate((db) => {
      const name = purposeText.trim();
      const purposeId = name ? repo.findOrCreatePurpose(db, name, category) : null;
      return repo.saveTransaction(db, { id, date, wallet_id: walletId, category_code: category, purpose_id: purposeId, amount: amount!, memo: memo.trim() || null });
    });
    try {
      localStorage.setItem(LAST_WALLET, String(walletId));
    } catch {
      /* 保存できなくても動作に影響なし */
    }
    const w = wallets.find((x) => x.id === walletId);
    const deltaWallet = w?.kind === 'debit' && bankId ? bankId : walletId;
    const delta = (category === 'income' ? 1 : -1) * amount! + (editing && editing.wallet_id === walletId ? (editing.category_code === 'income' ? -1 : 1) * editing.amount : 0);
    toast(id ? '更新しました' : `${w?.name} ${CATEGORY_LABEL[category]} ${yen(amount!)} を登録`);
    onSaved(txId, deltaWallet, delta);
    if (id) {
      go('entry');
    } else {
      setAmount(null);
      setPurposeText('');
      setMemo('');
      focusAmount();
    }
  };

  const remove = () => {
    if (!id || !confirm('この取引を削除しますか?')) return;
    mutate((db) => repo.deleteTransaction(db, id));
    toast('削除しました', 'warn');
    go('entry');
  };

  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      {id && <p className="editing-banner">編集中: {editing ? `${fmtMD(editing.date)} ${editing.purpose_name ?? editing.category_name} ${yen(editing.amount)}` : ''}</p>}
      <Field label="ウォレット" group>
        <Segmented options={wallets.map((w) => ({ value: w.id, label: w.name }))} value={walletId} onChange={setWalletId} />
      </Field>
      <Field label="区分" group>
        <div className="chips">
          {CODES.map((c) => (
            <button key={c} type="button" className={`chip-btn ${category === c ? 'on' : ''}`} style={{ ['--chip' as string]: CATEGORY_COLOR[c] }} onClick={() => setCategory(c)}>
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </Field>
      <div ref={amountRef}>
        <Field label="金額" hint="式も可: 1009+1133 / 400*5 / (1200+800)×2">
          <AmountInput value={amount} onChange={setAmount} autoFocus={!id} />
        </Field>
      </div>
      <details className="helper">
        <summary>弁当代を計算 (単価 {yen(bentoPrice)})</summary>
        <div className="helper-row">
          <input type="number" min={1} inputMode="numeric" value={days} placeholder="日数" aria-label="日数" onChange={(e) => setDays(e.target.value ? Number(e.target.value) : '')} />
          <span>日 × {yen(bentoPrice)} = <strong>{yen(bentoPrice * (Number(days) || 0))}</strong></span>
          <button type="button" className="btn" disabled={!days} onClick={() => { setAmount(bentoPrice * Number(days)); setCategory('food'); }}>金額に入れる</button>
        </div>
      </details>
      <Field label="用途" group>
        <input list="purpose-list" aria-label="用途" value={purposeText} placeholder="選択 or 入力 (新しい用途は自動で登録)" onChange={(e) => pickPurpose(e.target.value)} />
        <datalist id="purpose-list">
          {purposes.map((p) => <option key={p.id} value={p.name} />)}
        </datalist>
        <div className="chips small">
          {chips.map((p) => (
            <button key={p.id} type="button" className={`chip-btn ${purposeText === p.name ? 'on' : ''}`} onClick={() => pickPurpose(p.name)}>{p.name}</button>
          ))}
        </div>
      </Field>
      <div className="row2">
        <Field label="日付" group><DateInput value={date} onChange={setDate} /></Field>
        <Field label="メモ"><input value={memo} placeholder="任意" onChange={(e) => setMemo(e.target.value)} /></Field>
      </div>
      <div className="form-actions">
        {id && <button type="button" className="btn danger" onClick={remove}>削除</button>}
        <span className="spacer" />
        {id && <button type="button" className="btn ghost" onClick={() => go('entry')}>キャンセル</button>}
        <button className="btn primary" disabled={!valid}>{id ? '更新' : '登録'}</button>
      </div>
    </form>
  );
}

function LedgerPanel({ title, rows, flash, current, actual, editingId, onFixed }: { title: string; rows: ReturnType<typeof buildLedger>; flash: string | null; current: number; actual: number | null; editingId?: number; onFixed: (fixedId: number) => void }) {
  const { mutate, toast } = useApp();
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!flash) return;
    listRef.current?.querySelector(`[data-key="${flash}"], [data-key^="${flash}-"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [flash, rows]);
  // 新しい行が増えたら一番下 (最新) を表示
  useEffect(() => {
    const el = listRef.current;
    if (el && !flash) el.scrollTop = el.scrollHeight;
  }, [rows.length, title]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="panel ledger">
      <div className="ledger-head">
        <h2 title="行をタップすると編集 (固定費の行は左の「固定費」が開きます)。給料・プールの行は、月次予算・貯蓄の画面で変更します。">{title}</h2>
        <div className="ledger-sum">
          <span>現在 (計算) <strong>{yen(current)}</strong></span>
          {actual !== null && <span>実際 <strong>{yen(actual)}</strong></span>}
          {actual !== null && <span className={current - actual === 0 ? 'ok' : 'ng'}>{current - actual === 0 ? '✓ 一致' : `差 ${yen(current - actual)}`}</span>}
        </div>
      </div>
      <div className="ledger-list" ref={listRef}>
        <table className="table ledger-table">
          <thead>
            <tr><th>日付</th><th>内容</th><th className="r">入出金</th><th className="r">残高</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                data-key={r.key}
                className={`${r.kind} ${flash && (r.key === flash || r.key.startsWith(`${flash}-`)) ? 'flash' : ''} ${r.txId && r.txId === editingId ? 'editing' : ''} ${r.txId || r.fixedId ? 'clickable' : ''}`}
                onClick={() => (r.txId ? go('entry', r.txId) : r.fixedId ? onFixed(r.fixedId) : undefined)}
              >
                <td className="d">{fmtMD(r.date)}</td>
                <td className="c">
                  {r.category && <i style={{ background: CATEGORY_COLOR[r.category as CategoryCode] }} />}
                  {r.label}
                  {r.sub && <small>{r.sub}</small>}
                </td>
                <td className={`num ${r.amount > 0 ? 'plus' : r.amount < 0 ? 'minus' : ''}`}>{r.kind === 'opening' ? '' : `${r.amount > 0 ? '+' : ''}${yen(r.amount)}`}</td>
                <td className="num bal">{yen(r.balance)}</td>
                <td className="x">
                  {r.transferId && (
                    <button className="icon-btn small" aria-label="移動を削除" onClick={(e) => {
                      e.stopPropagation();
                      if (!confirm('この移動を削除しますか? (両方のウォレットから消えます)')) return;
                      mutate((db) => repo.deleteTransfer(db, r.transferId!));
                      toast('移動を削除しました', 'warn');
                    }}>×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">行をタップすると編集 (固定費の行は左の「固定費」が開きます)。給料・プールの行は、月次予算・貯蓄の画面で変更します。</p>
    </section>
  );
}
