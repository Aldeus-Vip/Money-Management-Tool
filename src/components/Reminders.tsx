import { useState } from 'react';
import { DateInput } from './DateInput';
import { Empty, Field } from './ui';
import * as repo from '../db/repo';
import { diffDays, fmtMDW, todayISO } from '../lib/date';
import { useApp, useQuery } from '../state/AppContext';

const until = (date: string, today: string) => {
  const n = diffDays(today, date);
  return n === 0 ? '今日' : n === 1 ? '明日' : `あと ${n} 日`;
};
const when = (r: repo.Reminder) => `${fmtMDW(r.date)}${r.time ? ` ${r.time}〜` : ''}`;

/** 次の予定 (右パネル・帯用の簡易表示)。当日はハイライト */
export function NextReminder({ variant }: { variant: 'pane' | 'strip' | 'card' }) {
  const today = todayISO();
  const next = useQuery((db) => repo.listReminders(db, today)[0]);
  if (!next) return variant === 'card' ? <a href="#reminders" className="next-rem card empty"><small>次の予定</small><span>予定はありません</span></a> : null;
  const isToday = next.date === today;
  return (
    <a href="#/dashboard" className={`next-rem ${variant} ${isToday ? 'today' : ''}`} title={next.memo ?? undefined}>
      <small>次の予定</small>
      <strong>{next.title}</strong>
      <span>{when(next)}</span>
      <em>{until(next.date, today)}</em>
      {variant !== 'strip' && next.memo && <p className="rem-memo">{next.memo}</p>}
    </a>
  );
}

/** 予定の一覧と登録 (ダッシュボード) */
export function ReminderPanel() {
  const { mutate, toast } = useApp();
  const today = todayISO();
  const list = useQuery((db) => repo.listReminders(db, today));
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const [memo, setMemo] = useState('');
  const add = () => {
    if (!title.trim()) return;
    mutate((db) => repo.saveReminder(db, { title: title.trim(), date, time: time || null, memo: memo.trim() || null }));
    toast('予定を登録しました');
    setTitle('');
    setTime('');
    setMemo('');
  };
  return (
    <section className="panel reminders" id="reminders">
      <h2>予定</h2>
      {list.length === 0 ? <Empty>これからの予定はありません</Empty> : (
        <ul className="rem-list">
          {list.map((r) => (
            <li key={r.id} className={r.date === today ? 'today' : ''}>
              <span className="rem-when">{when(r)}</span>
              <span className="rem-title">{r.title}{r.memo && <small>{r.memo}</small>}</span>
              <em>{until(r.date, today)}</em>
              <button className="icon-btn small" aria-label={`${r.title}を削除`} onClick={() => confirm('この予定を削除しますか?') && mutate((db) => repo.deleteReminder(db, r.id))}>×</button>
            </li>
          ))}
        </ul>
      )}
      <form className="rem-form" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Field label="内容"><input value={title} placeholder="例: 通院" onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="日付" group><DateInput value={date} onChange={setDate} /></Field>
        <Field label="時刻 (任意)"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        <Field label="メモ (任意)"><input value={memo} placeholder="持ち物・場所など" onChange={(e) => setMemo(e.target.value)} /></Field>
        <button className="btn" disabled={!title.trim()}>追加</button>
      </form>
      <p className="note">予定の内容はお手元の DB ファイルにだけ保存されます。次の予定は右側のパネル (狭い画面では上部の帯) に常に表示され、当日は強調されます。</p>
    </section>
  );
}
