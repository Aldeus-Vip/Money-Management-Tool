import { Fragment, useState } from 'react';
import { AmountInput, PageHead, Segmented } from '../components/ui';
import * as repo from '../db/repo';
import type { CategoryCode, FixedCost, FixedMode, Purpose, RuleKind } from '../db/repo';
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

const EMPTY_FIXED: Omit<FixedCost, 'id' | 'sort'> = { name: '', withdraw_day: null, cycle_months: 1, buffer: 0, default_amount: 0, active: 1, mode: 'fixed', bill_months: null };

function FixedCosts() {
  const { mutate, ym } = useApp();
  const rate = useQuery((db) => repo.getSettings(db).bufferRate);
  const list = useQuery((db) => repo.listFixedCosts(db).map((f) => ({ ...f, auto: repo.estimateDetail(db, f, ym, repo.getSettings(db).bufferRate), rules: repo.listRules(db, f.id) })), [ym]);
  const [open, setOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState(EMPTY_FIXED);
  const save = (f: FixedCost, patch: Partial<FixedCost>) => mutate((db) => repo.saveFixedCost(db, { ...f, ...patch }));
  const day = (v: string) => (v ? Math.min(31, Math.max(1, Number(v))) : null);

  return (
    <section className="panel">
      <div className="table-head">
        <h2>固定費 ({list.length})</h2>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>名称</th><th>引落日</th><th>請求月</th><th>算出方法</th><th>金額</th><th>バッファ</th><th className="r">今の自動額</th><th>予定</th><th>有効</th></tr>
          </thead>
          <tbody>
            {list.map((f) => (
              <Fragment key={f.id}>
              <tr className={`${f.active ? '' : 'inactive'} ${open === f.id ? 'open' : ''}`}>
                <td><TextCell value={f.name} onCommit={(name) => save(f, { name })} /></td>
                <td><input type="number" min={1} max={31} className="w-day" value={f.withdraw_day ?? ''} onChange={(e) => save(f, { withdraw_day: day(e.target.value) })} /></td>
                <td><BillMonthsSelect value={f.bill_months} onChange={(v) => save(f, { bill_months: v })} onCustom={() => setOpen(f.id)} /></td>
                <td>
                  <select value={f.mode} onChange={(e) => save(f, { mode: e.target.value as FixedMode })} aria-label="算出方法">
                    <option value="fixed">固定額</option>
                    <option value="average">過去平均</option>
                  </select>
                </td>
                <td><FixedDefault value={f.default_amount} onCommit={(v) => save(f, { default_amount: v })} /></td>
                <td className="center"><input type="checkbox" aria-label="バッファ" disabled={f.mode !== 'average'} checked={f.mode === 'average' && !!f.buffer} onChange={(e) => save(f, { buffer: e.target.checked ? 1 : 0 })} /></td>
                <td className="num" title={SOURCE_LABEL[f.auto.source]}>{yen(f.auto.amount)}{f.auto.source !== 'fixed' && f.auto.source !== 'average' && <small className="rule-src">{SOURCE_LABEL[f.auto.source]}</small>}</td>
                <td><button type="button" className={`btn ghost small-btn ${f.rules.length ? 'has' : ''}`} onClick={() => setOpen(open === f.id ? null : f.id)} aria-expanded={open === f.id}>{f.rules.length ? `${f.rules.length} 件` : '追加'} {open === f.id ? '▴' : '▾'}</button></td>
                <td className="center"><input type="checkbox" aria-label="有効" checked={!!f.active} onChange={(e) => save(f, { active: e.target.checked ? 1 : 0 })} /></td>
              </tr>
              {open === f.id && (
                <tr className="rule-row"><td colSpan={9}><RulesEditor f={f} rules={f.rules} onMonths={(v) => save(f, { bill_months: v })} /></td></tr>
              )}
              </Fragment>
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
        <select value={draft.mode} aria-label="算出方法" onChange={(e) => setDraft({ ...draft, mode: e.target.value as FixedMode })}>
          <option value="fixed">固定額</option>
          <option value="average">過去平均</option>
        </select>
        <div className="w-amt"><AmountInput value={draft.default_amount || null} placeholder="金額" onChange={(v) => setDraft({ ...draft, default_amount: v ?? 0 })} /></div>
        {draft.mode === 'average' && <label className="check"><input type="checkbox" checked={!!draft.buffer} onChange={(e) => setDraft({ ...draft, buffer: e.target.checked ? 1 : 0 })} /> バッファ</label>}
        <button className="btn">追加</button>
      </form>
      <dl className="kv note-kv">
        <div><dt>固定額</dt><dd>毎回「金額」をそのまま使う (家賃・サブスクなど)</dd></div>
        <div><dt>過去平均</dt><dd>直近12期間に手入力した引落額 (0 を除く) の平均。バッファ ✓ で +{Math.round(rate * 100)}%。実績が無いうちは「金額」を使う (電気・ガス・携帯など)</dd></div>
        <div><dt>今の自動額</dt><dd>選択中の期間で、予算額・引落額が「自動」のときに入る金額 (予定があれば予定の金額)</dd></div>
        <div><dt>請求月</dt><dd>請求のある月だけ、新しい期間に自動で入る (年1回・隔月など)</dd></div>
        <div><dt>予定</dt><dd>金額の変更を先に登録: 「以降ずっと」(値上げなど) / 「毎年この月」(年払い) / 「その月だけ」(一時的な金額)。優先は その月だけ → 毎年 → 以降ずっと → マスタの金額</dd></div>
        <div><dt>有効</dt><dd>✓ の固定費は、新しく開始する期間に自動で入る</dd></div>
      </dl>
    </section>
  );
}

const SOURCE_LABEL: Record<repo.AutoSource, string> = { once: 'その月だけ', yearly: '毎年この月', from: '以降ずっと', fixed: '固定額', average: '過去平均' };
const RULE_LABEL: Record<RuleKind, string> = { from: '以降ずっと', yearly: '毎年この月', once: 'その月だけ' };

function BillMonthsSelect({ value, onChange, onCustom }: { value: string | null; onChange: (v: string | null) => void; onCustom: () => void }) {
  const m = repo.parseMonths(value);
  const key = !m || m.length === 12 ? 'all' : m.join(',') === '2,4,6,8,10,12' ? 'even' : m.join(',') === '1,3,5,7,9,11' ? 'odd' : m.length === 1 ? `m${m[0]}` : 'custom';
  return (
    <select value={key} aria-label="請求月" onChange={(e) => {
      const v = e.target.value;
      if (v === 'all') onChange(null);
      else if (v === 'even') onChange('2,4,6,8,10,12');
      else if (v === 'odd') onChange('1,3,5,7,9,11');
      else if (v.startsWith('m')) onChange(v.slice(1));
      else onCustom();
    }}>
      <option value="all">毎月</option>
      <option value="even">偶数月</option>
      <option value="odd">奇数月</option>
      {Array.from({ length: 12 }, (_, i) => <option key={i} value={`m${i + 1}`}>年1回 ({i + 1}月)</option>)}
      <option value="custom">{key === 'custom' ? `${m!.join('・')}月` : '指定…'}</option>
    </select>
  );
}

function RulesEditor({ f, rules, onMonths }: { f: FixedCost; rules: repo.FixedRule[]; onMonths: (v: string | null) => void }) {
  const { mutate, ym } = useApp();
  const months = repo.parseMonths(f.bill_months) ?? Array.from({ length: 12 }, (_, i) => i + 1);
  const [kind, setKind] = useState<RuleKind>('from');
  const [ruleYm, setRuleYm] = useState(ym);
  const [month, setMonth] = useState(Number(ym.slice(5)));
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const toggle = (n: number) => {
    const next = months.includes(n) ? months.filter((x) => x !== n) : [...months, n].sort((a, b) => a - b);
    onMonths(next.length === 12 || next.length === 0 ? null : next.join(','));
  };
  const add = () => {
    if (amount === null) return;
    mutate((db) => repo.saveRule(db, { fixed_cost_id: f.id, kind, ym: kind === 'yearly' ? null : ruleYm, month: kind === 'yearly' ? month : null, amount, note: note.trim() || null }));
    setAmount(null);
    setNote('');
  };
  const when = (r: repo.FixedRule) => (r.kind === 'yearly' ? `毎年 ${r.month}月` : r.kind === 'from' ? `${r.ym?.replace('-', '/')} 〜` : `${r.ym?.replace('-', '/')} のみ`);
  return (
    <div className="rules">
      <div className="rules-months">
        <span className="field-label">請求月</span>
        <div className="month-chips">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className={`chip-btn ${months.includes(n) ? 'on' : ''}`} onClick={() => toggle(n)}>{n}月</button>
          ))}
        </div>
      </div>
      <div className="rules-list">
        <span className="field-label">金額の予定</span>
        {rules.length === 0 ? <p className="muted">予定はありません</p> : (
          <ul>
            {rules.map((r) => (
              <li key={r.id}>
                <span className={`rule-kind ${r.kind}`}>{RULE_LABEL[r.kind]}</span>
                <span className="rule-when">{when(r)}</span>
                <strong>{yen(r.amount)}</strong>
                <span className="muted">{r.note}</span>
                <button type="button" className="icon-btn small" aria-label="予定を削除" onClick={() => confirm('この予定を削除しますか?') && mutate((db) => repo.deleteRule(db, r.id))}>×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <form className="add-row wrap" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <select value={kind} onChange={(e) => setKind(e.target.value as RuleKind)} aria-label="予定の種類">
          <option value="from">以降ずっと (値上げ・値下げ)</option>
          <option value="yearly">毎年この月 (年払い)</option>
          <option value="once">その月だけ (一時的)</option>
        </select>
        {kind === 'yearly' ? (
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="月">
            {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}月</option>)}
          </select>
        ) : (
          <input type="month" value={ruleYm} onChange={(e) => setRuleYm(e.target.value)} aria-label="年月" className="w-month" />
        )}
        <div className="w-amt"><AmountInput value={amount} onChange={setAmount} placeholder="金額" /></div>
        <input value={note} placeholder="メモ (任意)" onChange={(e) => setNote(e.target.value)} className="w-note" />
        <button className="btn" disabled={amount === null}>予定を追加</button>
      </form>
      <p className="note">年月 = 給料日が属する月 (期間)。「毎年この月」「その月だけ」を登録すると、請求月以外でもその月は自動で入ります。</p>
    </div>
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
