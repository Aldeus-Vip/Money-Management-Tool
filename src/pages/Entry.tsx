import { useEffect, useMemo, useState } from 'react';
import { AmountInput, Field, PageHead, Segmented } from '../components/ui';
import * as repo from '../db/repo';
import type { CategoryCode } from '../db/repo';
import { CATEGORY_COLOR, CATEGORY_LABEL } from '../lib/categories';
import { fmtMD, todayISO } from '../lib/date';
import { yen } from '../lib/period';
import { useApp, useQuery } from '../state/AppContext';
import { go } from '../state/router';

const LAST_WALLET = 'last-wallet';
const CODES: CategoryCode[] = ['food', 'transport', 'fun', 'extra', 'other', 'income'];

function lastWallet(): number | null {
  try {
    return Number(localStorage.getItem(LAST_WALLET)) || null;
  } catch {
    return null;
  }
}

export function Entry({ id }: { id?: number }) {
  const { mutate, toast } = useApp();
  const wallets = useQuery((db) => repo.listWallets(db));
  const editing = useQuery((db) => (id ? repo.getTransaction(db, id) : undefined), [id]);

  const [date, setDate] = useState(todayISO());
  const [walletId, setWalletId] = useState<number>(() => lastWallet() ?? 0);
  const [category, setCategory] = useState<CategoryCode>('food');
  const [purposeText, setPurposeText] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [memo, setMemo] = useState('');

  const wid = wallets.some((w) => w.id === walletId) ? walletId : wallets[0]?.id;
  const purposes = useQuery((db) => repo.listPurposes(db, { walletId: wid }), [wid]);
  const recent = useQuery((db) => repo.listTransactions(db).slice(0, 5));

  useEffect(() => {
    if (!editing) return;
    setDate(editing.date);
    setWalletId(editing.wallet_id);
    setCategory(editing.category_code);
    setPurposeText(editing.purpose_name ?? '');
    setAmount(editing.amount);
    setMemo(editing.memo ?? '');
  }, [editing]);

  const chips = useMemo(() => purposes.filter((p) => !p.category_code || p.category_code === category).slice(0, 12), [purposes, category]);
  const valid = !!wid && amount !== null && amount > 0 && !!date;

  const pickPurpose = (name: string) => {
    setPurposeText(name);
    const p = purposes.find((x) => x.name === name);
    if (p?.category_code) setCategory(p.category_code);
  };

  const save = () => {
    if (!valid || !wid) return;
    mutate((db) => {
      const name = purposeText.trim();
      const purposeId = name ? repo.findOrCreatePurpose(db, name, category) : null;
      repo.saveTransaction(db, { id, date, wallet_id: wid, category_code: category, purpose_id: purposeId, amount: amount!, memo: memo.trim() || null });
    });
    try {
      localStorage.setItem(LAST_WALLET, String(wid));
    } catch {
      /* 保存できなくても動作に影響なし */
    }
    toast(id ? '更新しました' : `${CATEGORY_LABEL[category]} ${yen(amount!)} を保存しました`);
    if (id) {
      go('list');
    } else {
      setAmount(null);
      setPurposeText('');
      setMemo('');
    }
  };

  const remove = () => {
    if (!id || !confirm('この取引を削除しますか?')) return;
    mutate((db) => repo.deleteTransaction(db, id));
    toast('削除しました', 'warn');
    go('list');
  };

  if (id && !editing) return <p className="empty">取引が見つかりません</p>;

  return (
    <div className="page narrow">
      <PageHead title={id ? '取引の編集' : '取引入力'} />
      <form
        className="panel form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="ウォレット" group>
          <Segmented options={wallets.map((w) => ({ value: w.id, label: w.name }))} value={wid ?? 0} onChange={setWalletId} />
        </Field>

        <Field label="区分" group>
          <div className="chips">
            {CODES.map((c) => (
              <button
                key={c}
                type="button"
                className={`chip-btn ${category === c ? 'on' : ''}`}
                style={{ ['--chip' as string]: CATEGORY_COLOR[c] }}
                onClick={() => setCategory(c)}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="金額" hint="「1009+1133」のような足し算も可">
          <AmountInput value={amount} onChange={setAmount} autoFocus={!id} />
        </Field>

        <Field label="用途" group>
          <input list="purpose-list" aria-label="用途" value={purposeText} placeholder="選択 or 入力 (新しい用途は自動で登録)" onChange={(e) => pickPurpose(e.target.value)} />
          <datalist id="purpose-list">
            {purposes.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
          <div className="chips small">
            {chips.map((p) => (
              <button key={p.id} type="button" className={`chip-btn ${purposeText === p.name ? 'on' : ''}`} onClick={() => pickPurpose(p.name)}>
                {p.name}
              </button>
            ))}
          </div>
        </Field>

        <div className="row2">
          <Field label="日付">
            <input type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="メモ">
            <input value={memo} placeholder="任意" onChange={(e) => setMemo(e.target.value)} />
          </Field>
        </div>

        <div className="form-actions">
          {id && (
            <button type="button" className="btn danger" onClick={remove}>
              削除
            </button>
          )}
          <span className="spacer" />
          {id && (
            <button type="button" className="btn ghost" onClick={() => go('list')}>
              キャンセル
            </button>
          )}
          <button className="btn primary" disabled={!valid}>
            {id ? '更新' : '保存'}
          </button>
        </div>
      </form>

      {!id && recent.length > 0 && (
        <section className="panel">
          <h2>直近の入力</h2>
          <ul className="tx-list compact">
            {recent.map((t) => (
              <li key={t.id} onClick={() => go('entry', t.id)}>
                <i style={{ background: CATEGORY_COLOR[t.category_code] }} />
                <time>{fmtMD(t.date)}</time>
                <span className="tx-main">{t.purpose_name ?? t.category_name}<small>{t.wallet_name}</small></span>
                <strong className={t.category_code === 'income' ? 'plus' : ''}>{yen(t.amount)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
