import { useEffect, useState, type ReactNode } from 'react';
import { evalAmount, isExpression } from '../lib/budget';
import { yen } from '../lib/period';

export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

/** group=true はボタン群など (label で包むとクリックが先頭ボタンに伝播するため div にする) */
export function Field({ label, hint, group, children }: { label: string; hint?: ReactNode; group?: boolean; children: ReactNode }) {
  const inner = (
    <>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </>
  );
  return group ? (
    <div className="field" role="group" aria-label={label}>
      {inner}
    </div>
  ) : (
    <label className="field">{inner}</label>
  );
}

/** 金額入力。"1009+1133" のような式も可。確定時に数値化 */
export function AmountInput({
  value, onChange, autoFocus, placeholder, allowNegative,
}: { value: number | null; onChange: (v: number | null) => void; autoFocus?: boolean; placeholder?: string; allowNegative?: boolean }) {
  const fmt = (v: number | null) => (v === null ? '' : v.toLocaleString('ja-JP'));
  const [text, setText] = useState(fmt(value));
  useEffect(() => {
    setText((t) => (evalAmount(t) === value ? t : fmt(value)));
  }, [value]);
  const parsed = evalAmount(text);
  const invalid = text !== '' && (parsed === null || (!allowNegative && parsed < 0));
  return (
    <div className={`amount-input ${invalid ? 'invalid' : ''}`}>
      <span>¥</span>
      <input
        inputMode="text"
        autoFocus={autoFocus}
        placeholder={placeholder ?? '金額'}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const v = evalAmount(e.target.value);
          onChange(e.target.value === '' ? null : v);
        }}
        onBlur={() => parsed !== null && setText(fmt(parsed))}
      />
      {isExpression(text) && parsed !== null && <small>= {yen(parsed)}</small>}
    </div>
  );
}

export function Segmented<T extends string | number>({
  options, value, onChange, small,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className={`segmented ${small ? 'small' : ''}`} role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
