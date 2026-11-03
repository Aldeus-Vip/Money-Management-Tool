import { PageHead } from '../components/ui';

const INFO: Record<string, { title: string; items: string[] }> = {
  wallets: { title: '口座・残高', items: ['期首残高と現在残高', '口座入出金 (出金・チャージ・入金・振込・手数料)', '実残高の入力 → 不明金チェック'] },
  fixed: { title: '固定費', items: ['引落予定のカレンダー表示', '引落済チェックと口座残高の見込み'] },
  pools: { title: '貯蓄・プール', items: ['貯金・娯楽費の残高', 'プールからの使用記録 (臨時費用補填など)'] },
  analysis: { title: '分析', items: ['予算消化ペースのグラフ (食費・臨時費用)', '月別の費用実績表と年平均'] },
};

export function Phase2({ route }: { route: string }) {
  const info = INFO[route];
  return (
    <div className="page narrow">
      <PageHead title={info.title} />
      <section className="panel">
        <h2>Phase 2 で実装予定</h2>
        <ul className="plain">
          {info.items.map((i) => <li key={i}>{i}</li>)}
        </ul>
      </section>
    </div>
  );
}
