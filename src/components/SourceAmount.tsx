import { useEffect, useState } from 'react';
import { AmountInput } from './ui';
import { yen } from '../lib/period';

interface Props {
  /** 手入力値 (null = マスタから自動) */
  input: number | null;
  /** マスタからの自動額 */
  auto: number;
  onSet: (v: number | null) => void;
  label: string;
}

/**
 * 自動 (マスタ参照) と手入力を見分けられる金額セル。
 * Excel で「関数が入っていれば自動・数値直打ちなら手入力、条件付き書式で色分け」していた運用の置き換え。
 * - 自動: シアンの点線枠 + 「自動」
 * - 手入力: アンバーの枠 + 「手入力」 + ↺ (マスタに戻す)
 */
export function SourceAmount({ input, auto, onSet, label }: Props) {
  const manual = input !== null;
  const shown = input ?? auto;
  const [v, setV] = useState<number | null>(shown);
  useEffect(() => setV(shown), [shown]);
  const commit = () => {
    if (v === null || v === shown) return setV(shown);
    onSet(v);
  };
  return (
    <div className={`src-amount ${manual ? 'manual' : 'auto'}`} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()}>
      <AmountInput value={v} onChange={setV} />
      <span className="src-badge" title={manual ? `手入力 (マスタの自動額は ${yen(auto)})` : 'マスタから自動'}>{manual ? '手入力' : '自動'}</span>
      {manual && (
        <button type="button" className="src-reset" aria-label={`${label}をマスタに戻す`} title={`マスタに戻す (${yen(auto)})`} onClick={() => onSet(null)}>
          ↺
        </button>
      )}
    </div>
  );
}

export function SourceLegend() {
  return (
    <p className="src-legend">
      <span className="src-chip auto">自動</span> マスタから自動で入る金額
      <span className="src-chip manual">手入力</span> 入力した金額 (↺ でマスタに戻す)
    </p>
  );
}
