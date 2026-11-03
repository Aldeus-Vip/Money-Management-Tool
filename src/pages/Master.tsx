import { useState } from 'react';
import { AmountInput, PageHead, Segmented } from '../components/ui';
import * as repo from '../db/repo';
import type { CategoryCode, FixedCost, Purpose } from '../db/repo';
import { CATEGORY_LABEL } from '../lib/categories';
import { yen } from '../lib/period';
import { useApp, useQuery } from '../state/AppContext';

type Tab = 'purposes' | 'fixed' | 'wallets';

export function Master() {
  const [tab, setTab] = useState<Tab>('purposes');
  return (
    <div className="page">
      <PageHead title="マスタ管理" />
      <Segmented
        options={[{ value: 'purposes', label: '用途' }, { value: 'fixed', label: '固定費' }, { value: 'wallets', label: 'ウォレット' }]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'purposes' && <Purposes />}
      {tab === 'fixed' && <FixedCosts />}
      {tab === 'wallets' && <Wallets />}
    </div>
  );
}

/** 入力中は保持し、フォーカスが外れたら確定 */
function TextCell({ value, onCommit, placeholder }: { value: string; onCommit: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState(value);
  return (
    <input
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() && v !== value ? onCommit(v.trim()) : setV(value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

function Purposes() {
  const { mutate } = useApp();
  const [showInactive, setShowInactive] = useState(false);
  const wallets = useQuery((db) => repo.listWallets(db));
  const list = useQuery((db) => repo.listPurposes(db, { activeOnly: !showInactive }), [showInactive]);
  const [newName, setNewName] = useState('');
  const save = (p: Purpose, patch: Partial<Purpose>) => mutate((db) => repo.savePurpose(db, { ...p, ...patch }));

  return (
    <section className="panel">
      <div className="table-head">
        <h2>用途 ({list.length})</h2>
        <label className="check">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> 無効も表示
        </label>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>名称</th><th>既定の区分</th><th>ウォレット</th><th>課金</th><th>使用</th><th>有効</th></tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className={p.active ? '' : 'inactive'}>
                <td><TextCell value={p.name} onCommit={(name) => save(p, { name })} /></td>
                <td>
                  <select value={p.category_code ?? ''} onChange={(e) => save(p, { category_code: (e.target.value || null) as CategoryCode | null })}>
                    <option value="">指定なし</option>
                    {(Object.keys(CATEGORY_LABEL) as CategoryCode[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                  </select>
                </td>
                <td>
                  <select value={p.wallet_id ?? 0} onChange={(e) => save(p, { wallet_id: Number(e.target.value) || null })}>
                    <option value={0}>共通</option>
                    {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </td>
                <td className="center"><input type="checkbox" aria-label="課金として集計" checked={!!p.is_charge} onChange={(e) => save(p, { is_charge: e.target.checked ? 1 : 0 })} /></td>
                <td className="num">{p.uses}</td>
                <td className="center"><input type="checkbox" aria-label="有効" checked={!!p.active} onChange={(e) => save(p, { active: e.target.checked ? 1 : 0 })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          mutate((db) => repo.savePurpose(db, { name: newName.trim(), wallet_id: null, category_code: null, is_charge: 0, active: 1 }));
          setNewName('');
        }}
      >
        <input value={newName} placeholder="新しい用途" onChange={(e) => setNewName(e.target.value)} />
        <button className="btn">追加</button>
      </form>
      <p className="note">「課金」に✓を付けた用途 (娯楽費) は、課金枠として別集計されます。使わなくなった用途は削除せず無効にします (過去の取引を残すため)。</p>
    </section>
  );
}

const EMPTY_FIXED: Omit<FixedCost, 'id' | 'sort'> = { name: '', withdraw_day: null, cycle_months: 1, buffer: 0, default_amount: 0, active: 1 };

function FixedCosts() {
  const { mutate } = useApp();
  const list = useQuery((db) => repo.listFixedCosts(db));
  const [draft, setDraft] = useState(EMPTY_FIXED);
  const save = (f: FixedCost, patch: Partial<FixedCost>) => mutate((db) => repo.saveFixedCost(db, { ...f, ...patch }));
  const day = (v: string) => (v ? Math.min(31, Math.max(1, Number(v))) : null);

  return (
    <section className="panel">
      <div className="table-head">
        <h2>固定費 ({list.length}) <span className="muted">既定額合計 {yen(list.filter((f) => f.active).reduce((s, f) => s + f.default_amount, 0))}</span></h2>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>名称</th><th>引落日</th><th>請求周期</th><th>バッファ</th><th>既定額</th><th>有効</th></tr>
          </thead>
          <tbody>
            {list.map((f) => (
              <tr key={f.id} className={f.active ? '' : 'inactive'}>
                <td><TextCell value={f.name} onCommit={(name) => save(f, { name })} /></td>
                <td><input type="number" min={1} max={31} className="w-day" value={f.withdraw_day ?? ''} onChange={(e) => save(f, { withdraw_day: day(e.target.value) })} /></td>
                <td>
                  <select value={f.cycle_months} onChange={(e) => save(f, { cycle_months: Number(e.target.value) })}>
                    <option value={1}>毎月</option>
                    <option value={2}>2ヶ月毎</option>
                  </select>
                </td>
                <td className="center"><input type="checkbox" aria-label="バッファ" checked={!!f.buffer} onChange={(e) => save(f, { buffer: e.target.checked ? 1 : 0 })} /></td>
                <td><FixedDefault value={f.default_amount} onCommit={(v) => save(f, { default_amount: v })} /></td>
                <td className="center"><input type="checkbox" aria-label="有効" checked={!!f.active} onChange={(e) => save(f, { active: e.target.checked ? 1 : 0 })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="add-row wrap"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.name.trim()) return;
          mutate((db) => repo.saveFixedCost(db, { ...draft, name: draft.name.trim() }));
          setDraft(EMPTY_FIXED);
        }}
      >
        <input value={draft.name} placeholder="名称 (例: 家賃)" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input type="number" min={1} max={31} className="w-day" placeholder="引落日" value={draft.withdraw_day ?? ''} onChange={(e) => setDraft({ ...draft, withdraw_day: day(e.target.value) })} />
        <div className="w-amt"><AmountInput value={draft.default_amount || null} placeholder="既定額" onChange={(v) => setDraft({ ...draft, default_amount: v ?? 0 })} /></div>
        <label className="check"><input type="checkbox" checked={!!draft.buffer} onChange={(e) => setDraft({ ...draft, buffer: e.target.checked ? 1 : 0 })} /> バッファ</label>
        <button className="btn">追加</button>
      </form>
      <p className="note">
        バッファ: 推定額に +10% (電気・ガスなど変動するもの)。推定額は「過去の実額の平均」。2ヶ月毎の請求は請求のある期間だけ記録すれば、1回あたりの額で推定されます。
        新しく追加した固定費は、次に開始する期間から自動で入ります (開始済みの期間は月次予算画面で追加)。
      </p>
    </section>
  );
}

function FixedDefault({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState<number | null>(value);
  return (
    <div className="w-amt" onBlur={() => v !== null && v !== value && onCommit(v)}>
      <AmountInput value={v} onChange={setV} />
    </div>
  );
}

function Wallets() {
  const { mutate } = useApp();
  const list = useQuery((db) => repo.listWallets(db, false));
  return (
    <section className="panel">
      <h2>ウォレット</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>名称</th><th>種類</th><th>有効</th></tr></thead>
          <tbody>
            {list.map((w) => (
              <tr key={w.id} className={w.active ? '' : 'inactive'}>
                <td><TextCell value={w.name} onCommit={(name) => mutate((db) => repo.updateWallet(db, { ...w, name }))} /></td>
                <td className="muted">{{ bank: '銀行口座', debit: 'デビット', cash: '現金', emoney: '電子マネー' }[w.kind] ?? w.kind}</td>
                <td className="center"><input type="checkbox" aria-label="有効" checked={!!w.active} onChange={(e) => mutate((db) => repo.updateWallet(db, { ...w, active: e.target.checked ? 1 : 0 }))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">ウォレット間の移動 (チャージ・出金) と残高は Phase 2 で追加予定です。</p>
    </section>
  );
}
