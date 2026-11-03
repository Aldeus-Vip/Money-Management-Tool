import { useState } from 'react';
import { Empty, PageHead, Segmented } from '../components/ui';
import * as repo from '../db/repo';
import type { CategoryCode, Transaction } from '../db/repo';
import { CATEGORY_COLOR, CATEGORY_LABEL } from '../lib/categories';
import { fmtMDW } from '../lib/date';
import { yen } from '../lib/period';
import { useApp, useQuery } from '../state/AppContext';
import { go } from '../state/router';

export function Transactions() {
  const { ym } = useApp();
  const [scope, setScope] = useState<'period' | 'all'>('period');
  const [walletId, setWalletId] = useState(0);
  const [category, setCategory] = useState<CategoryCode | ''>('');
  const [text, setText] = useState('');

  const wallets = useQuery((db) => repo.listWallets(db));
  const txs = useQuery((db) => {
    const r = repo.periodRange(db, ym);
    return repo.listTransactions(db, {
      ...(scope === 'period' ? { from: r.start, to: r.end } : {}),
      walletId: walletId || undefined,
      category: category || undefined,
      text: text.trim() || undefined,
    });
  }, [ym, scope, walletId, category, text]);

  const groups = new Map<string, Transaction[]>();
  for (const t of txs) groups.set(t.date, [...(groups.get(t.date) ?? []), t]);
  const spent = txs.filter((t) => t.category_code !== 'income').reduce((s, t) => s + t.amount, 0);
  const received = txs.filter((t) => t.category_code === 'income').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="page">
      <PageHead title="取引一覧">
        <a className="btn primary" href="#/entry">＋ 入力</a>
      </PageHead>

      <section className="panel filters">
        <Segmented small options={[{ value: 'period', label: '選択中の期間' }, { value: 'all', label: '全期間' }]} value={scope} onChange={setScope} />
        <select value={walletId} onChange={(e) => setWalletId(Number(e.target.value))} aria-label="ウォレット">
          <option value={0}>すべてのウォレット</option>
          {wallets.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value as CategoryCode | '')} aria-label="区分">
          <option value="">すべての区分</option>
          {(Object.keys(CATEGORY_LABEL) as CategoryCode[]).map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </select>
        <input type="search" placeholder="用途・メモで検索" value={text} onChange={(e) => setText(e.target.value)} />
      </section>

      <p className="totals">
        <span>{txs.length} 件</span>
        <span>支出 <strong>{yen(spent)}</strong></span>
        {received > 0 && <span>受取 <strong className="plus">+{yen(received)}</strong></span>}
      </p>

      {txs.length === 0 ? (
        <Empty>該当する取引はありません</Empty>
      ) : (
        [...groups].map(([date, list]) => (
          <section key={date} className="panel day-group">
            <h2>
              {fmtMDW(date)}
              <span>{yen(list.filter((t) => t.category_code !== 'income').reduce((s, t) => s + t.amount, 0))}</span>
            </h2>
            <ul className="tx-list">
              {list.map((t) => (
                <li key={t.id} onClick={() => go('entry', t.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go('entry', t.id)}>
                  <i style={{ background: CATEGORY_COLOR[t.category_code] }} />
                  <span className="tx-cat">{t.category_name}</span>
                  <span className="tx-main">
                    {t.purpose_name ?? '—'}
                    <small>{t.wallet_name}{t.memo ? ` · ${t.memo}` : ''}</small>
                  </span>
                  <strong className={t.category_code === 'income' ? 'plus' : ''}>
                    {t.category_code === 'income' ? '+' : ''}{yen(t.amount)}
                  </strong>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
