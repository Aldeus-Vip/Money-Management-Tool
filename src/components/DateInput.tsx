import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { fromISO, toISO, type ISODate } from '../lib/date';
import { isHoliday } from '../lib/holidays';

const WD = ['日', '月', '火', '水', '木', '金', '土'];
const pad = (n: number) => String(n).padStart(2, '0');

/** 表示: 2026/11/03 (火) */
export const fmtFull = (s: ISODate) => {
  const d = fromISO(s);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} (${WD[d.getDay()]})`;
};

/**
 * 日付選択 (日曜始まり)。
 * ブラウザ標準の日付入力は言語設定で月曜始まり・日/月/年表示になるため、独自のカレンダーにしている。
 * 土曜 = 青、日曜・祝日 = 赤。
 */
export function DateInput({ value, onChange, label = '日付' }: { value: ISODate; onChange: (v: ISODate) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => fromISO(value || toISO(new Date())));
  const ref = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<CSSProperties>({});

  // スクロールする枠の中でも切れないよう、画面基準 (fixed) で表示。下に余裕が無ければ上に開く
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = fieldRef.current?.getBoundingClientRect();
      if (!r) return;
      const H = 340, W = Math.min(290, window.innerWidth - 24);
      const below = window.innerHeight - r.bottom;
      const top = below >= H + 8 || below > r.top ? r.bottom + 6 : r.top - H - 6;
      setPos({ position: 'fixed', top: Math.max(8, top), left: Math.max(12, Math.min(r.left, window.innerWidth - W - 12)), width: W });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) setView(fromISO(value || toISO(new Date())));
  }, [open, value]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const y = view.getFullYear();
  const m = view.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => {
    const day = i - first + 1;
    return day >= 1 && day <= days ? new Date(y, m, day) : null;
  });
  const today = toISO(new Date());
  const pick = (d: Date) => {
    onChange(toISO(d));
    setOpen(false);
  };
  const shiftDay = (n: number) => {
    const d = fromISO(value || today);
    d.setDate(d.getDate() + n);
    onChange(toISO(d));
  };

  return (
    <div className="date-input" ref={ref}>
      <button type="button" className="di-prev" aria-label="前の日" onClick={() => shiftDay(-1)}>‹</button>
      <button type="button" ref={fieldRef} className="di-field" aria-label={`${label}: ${value ? fmtFull(value) : '未選択'}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{value ? fmtFull(value) : '日付を選択'}</span>
        <i aria-hidden>▾</i>
      </button>
      <button type="button" className="di-next" aria-label="次の日" onClick={() => shiftDay(1)}>›</button>
      {open && (
        <div className="di-pop panel" style={pos} role="dialog" aria-label={`${label}を選択`}>
          <div className="di-head">
            <button type="button" aria-label="前の月" onClick={() => setView(new Date(y, m - 1, 1))}>◀</button>
            <strong>{y}年 {m + 1}月</strong>
            <button type="button" aria-label="次の月" onClick={() => setView(new Date(y, m + 1, 1))}>▶</button>
          </div>
          <div className="di-grid">
            {WD.map((w, i) => <b key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</b>)}
            {cells.map((d, i) =>
              d ? (
                <button
                  key={i}
                  type="button"
                  className={[
                    d.getDay() === 0 || isHoliday(d) ? 'sun' : d.getDay() === 6 ? 'sat' : '',
                    toISO(d) === value ? 'on' : '',
                    toISO(d) === today ? 'today' : '',
                  ].join(' ')}
                  aria-label={fmtFull(toISO(d))}
                  aria-pressed={toISO(d) === value}
                  onClick={() => pick(d)}
                >
                  {d.getDate()}
                </button>
              ) : (
                <span key={i} />
              ),
            )}
          </div>
          <div className="di-foot">
            <button type="button" className="link" onClick={() => pick(new Date())}>今日</button>
          </div>
        </div>
      )}
    </div>
  );
}
