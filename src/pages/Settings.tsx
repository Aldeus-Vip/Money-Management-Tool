import { useState } from 'react';
import { AmountInput, Field, PageHead } from '../components/ui';
import * as repo from '../db/repo';
import { SCHEMA_VERSION } from '../db/schema';
import { downloadBytes, fileApiSupported, pickNewFile } from '../db/storage';
import { todayISO } from '../lib/date';
import { hashPin, isValidPin, verifyPin } from '../lib/pin';
import { paydayOf } from '../lib/period';
import { useApp, useQuery } from '../state/AppContext';

function Imports() {
  const { mutate, toast } = useApp();
  const batches = useQuery((d) => repo.listBatches(d));
  return (
    <section className="panel">
      <h2>データ取り込み (Excel)</h2>
      <p className="note">
        過去の Excel (2023年10月〜) の取り込みは、ファイル形式を確認したうえで対応します。
        取り込んだデータは「取り込み単位」ごとに記録され、ここから単位ごとに削除してやり直せます (手入力のデータには影響しません)。
      </p>
      {batches.length === 0 ? (
        <p className="empty">取り込み履歴はありません</p>
      ) : (
        <ul className="tx-list compact">
          {batches.map((b) => (
            <li key={b.id}>
              <i style={{ background: 'var(--c-blue)' }} />
              <time>{b.imported_at.slice(5, 10).replace('-', '/')}</time>
              <span className="tx-main">{b.source}<small>{b.rows} 行{b.note ? ` · ${b.note}` : ''}</small></span>
              <span />
              <button className="icon-btn small" aria-label="取り込みを削除" onClick={() => {
                if (!confirm(`「${b.source}」で取り込んだ ${b.rows} 行を削除しますか?`)) return;
                mutate((d) => repo.deleteBatch(d, b.id));
                toast('取り込みを削除しました', 'warn');
              }}>×</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Settings() {
  const { db, storage, saveState, saveNow, connect, disconnect, mutate, toast, ym, refresh } = useApp();
  const s = useQuery((d) => repo.getSettings(d));
  const counts = useQuery((d) => ({
    tx: Number(d.exec('SELECT COUNT(*) FROM transactions')[0].values[0][0]),
    periods: Number(d.exec('SELECT COUNT(*) FROM periods')[0].values[0][0]),
  }));
  const set = (k: string, v: string) => mutate((d) => repo.setSetting(d, k, v));

  const moveToFile = async () => {
    try {
      const target = await pickNewFile();
      await target.save(db.export(), true);
      await connect(target);
      toast('ファイルに移行しました。PIN を入力してください');
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') toast(String(e), 'danger');
    }
  };

  return (
    <div className="page narrow">
      <PageHead title="設定" />

      <section className="panel">
        <h2>データベース</h2>
        <dl className="kv">
          <div><dt>保存先</dt><dd>{storage?.kind === 'file' ? 'ファイル' : 'ブラウザ内'} — {storage?.label}</dd></div>
          <div><dt>状態</dt><dd className={`save-text save-${saveState}`}>{{ saved: '保存済み', pending: '未保存', saving: '保存中…', error: '保存エラー', conflict: '外部で変更されています' }[saveState]}</dd></div>
          <div><dt>データ</dt><dd>取引 {counts.tx} 件 / 期間 {counts.periods} 件 (スキーマ v{SCHEMA_VERSION})</dd></div>
        </dl>
        {saveState === 'conflict' && (
          <div className="conflict">
            <p className="note warn">ファイルが他の場所 (別の端末など) で更新されています。どちらを残すか選んでください。</p>
            <button className="btn" onClick={() => storage && void connect(storage)}>ファイルを読み直す (この画面の未保存分は破棄)</button>
            <button className="btn danger" onClick={() => void saveNow(true)}>この画面の内容で上書き</button>
          </div>
        )}
        {saveState === 'error' && <button className="btn" onClick={() => void saveNow()}>保存を再試行</button>}
        <p className="note">
          {storage?.kind === 'file'
            ? '別の端末 (OneDrive 同期) での変更は、アプリに戻ったときと 30 秒ごとに確認し、自動で読み込みます (未保存の入力があるときは読み込みません)。'
            : 'ブラウザ内保存は、この端末のブラウザの中だけのデータです。OneDrive や他の端末とは同期されません。'}
        </p>
        <div className="btn-row">
          {storage?.kind === 'file' && <button className="btn" onClick={() => void refresh(true)}>最新のデータを確認</button>}
          <button className="btn" onClick={() => downloadBytes(db.export(), `money-backup-${todayISO()}.sqlite`)}>バックアップをダウンロード</button>
          {storage?.kind === 'browser' && fileApiSupported() && <button className="btn" onClick={() => void moveToFile()}>ファイル保存に移行</button>}
          <button className="btn ghost" onClick={disconnect}>別のデータを開く</button>
        </div>
      </section>

      <section className="panel form">
        <h2>給料日</h2>
        <div className="row2">
          <Field label="給料日 (日)" hint={`例: ${ym} → ${paydayOf(ym, repo.paydayRule(s))}`}>
            <input type="number" min={1} max={31} value={s.paydayDay} onChange={(e) => e.target.value && set('payday_day', String(Math.min(31, Math.max(1, Number(e.target.value)))))} />
          </Field>
          <Field label="祝日も前倒し" hint="土日は常に前倒し">
            <label className="switch">
              <input type="checkbox" checked={s.paydayHolidays} onChange={(e) => set('payday_holidays', e.target.checked ? '1' : '0')} />
              <span>{s.paydayHolidays ? 'ON' : 'OFF'}</span>
            </label>
          </Field>
        </div>
        <p className="note">登録済みの期間は、登録した開始日が優先されます。</p>
      </section>

      <section className="panel form">
        <h2>計算の係数</h2>
        <div className="row2">
          <Field label="固定費バッファ (%)">
            <input type="number" min={0} max={100} value={Math.round(s.bufferRate * 100)} onChange={(e) => set('fixed_buffer_rate', String(Number(e.target.value) / 100))} />
          </Field>
          <Field label="推奨値の倍率" hint="食費・臨時費用の過去平均に掛ける">
            <input type="number" step="0.01" min={1} value={s.avgRate} onChange={(e) => set('avg_rate', e.target.value || '1')} />
          </Field>
        </div>
        <Field label="弁当の単価" hint="入力・照合の「弁当代を計算」で使用">
          <AmountInput value={s.bentoPrice} onChange={(v) => v !== null && set('bento_price', String(v))} />
        </Field>
        <Field label="臨時費用の最低額">
          <AmountInput value={s.extraMin} onChange={(v) => v !== null && set('extra_min', String(v))} />
        </Field>
        <Field label="期首残高を自由枠に加算 (Excel 方式)" hint="Excel では給料前の残高 (口座・現金・PayPay・Suica) を自由枠に足していました。繰越ルールの確定まで仮の設定です">
          <label className="switch">
            <input type="checkbox" checked={s.carryOpening} onChange={(e) => set('carry_opening', e.target.checked ? '1' : '0')} />
            <span>{s.carryOpening ? 'ON' : 'OFF (その他加算で手入力)'}</span>
          </label>
        </Field>
      </section>

      <Imports />

      <PinChange hash={s.pinHash} salt={s.pinSalt} onSave={async (pin) => {
        const h = await hashPin(pin);
        mutate((d) => {
          repo.setSetting(d, 'pin_hash', h.hash);
          repo.setSetting(d, 'pin_salt', h.salt);
        });
        toast('PIN を変更しました');
      }} />
    </div>
  );
}

function PinChange({ hash, salt, onSave }: { hash: string | null; salt: string | null; onSave: (pin: string) => Promise<void> }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [msg, setMsg] = useState('');
  const submit = async () => {
    if (hash && salt && !(await verifyPin(cur, hash, salt))) return setMsg('現在の PIN が違います');
    if (!isValidPin(next)) return setMsg('新しい PIN は4〜8桁の数字');
    if (next !== again) return setMsg('確認用が一致しません');
    await onSave(next);
    setCur('');
    setNext('');
    setAgain('');
    setMsg('');
  };
  const pinProps = { type: 'password', inputMode: 'numeric' as const, maxLength: 8, autoComplete: 'off' };
  return (
    <form className="panel form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <h2>PIN の変更</h2>
      <div className="row3">
        <Field label="現在の PIN"><input {...pinProps} value={cur} onChange={(e) => setCur(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label="新しい PIN"><input {...pinProps} value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label="確認"><input {...pinProps} value={again} onChange={(e) => setAgain(e.target.value.replace(/\D/g, ''))} /></Field>
      </div>
      {msg && <p className="note danger">{msg}</p>}
      <div className="form-actions"><span className="spacer" /><button className="btn primary" disabled={!next}>変更</button></div>
      <p className="note">10分間操作がないと自動でロックされます。</p>
    </form>
  );
}
