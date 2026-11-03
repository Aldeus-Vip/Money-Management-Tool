import { useEffect, useState } from 'react';
import { AmountInput } from './ui';

/** フォーカスが外れた時 (または Enter) に確定する金額セル */
export function CommitAmount({ value, onCommit, allowEmpty, placeholder }: { value: number | null; onCommit: (v: number | null) => void; allowEmpty?: boolean; placeholder?: string }) {
  const [v, setV] = useState<number | null>(value);
  useEffect(() => setV(value), [value]);
  return (
    <div
      className="inline-amount"
      onBlur={() => v !== value && (v !== null || allowEmpty) && onCommit(v)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()}
    >
      <AmountInput value={v} onChange={setV} allowNegative placeholder={placeholder ?? (allowEmpty ? '未入力' : '0')} />
    </div>
  );
}
