import { useEffect, useState } from 'react';
import { Emblem } from '../components/Emblem';
import { useApp } from '../state/AppContext';
import {
  fileApiSupported, forgetRemembered, getRemembered, pickExistingFile, pickNewFile, resume, useBrowserStorage, type Remembered, type Storage,
} from '../db/storage';

export function Connect() {
  const { connect } = useApp();
  const [remembered, setRemembered] = useState<Remembered>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileOk = fileApiSupported();

  useEffect(() => {
    void getRemembered().then(setRemembered);
  }, []);

  const run = async (get: () => Promise<Storage | null>) => {
    setBusy(true);
    setError('');
    try {
      const s = await get();
      if (!s) {
        setError('ファイルへのアクセスが許可されませんでした。');
        return;
      }
      await connect(s);
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <div className="gate-card panel">
        <Emblem size={96} />
        <h1 className="gate-title">MONEY MANAGEMENT</h1>
        <p className="gate-sub">データベースを選択してください</p>

        {remembered && (
          <div className="gate-resume">
            <button className="btn primary block" disabled={busy} onClick={() => run(() => resume(remembered))}>
              前回のデータを開く
              <small>{remembered.kind === 'file' ? remembered.handle.name : 'ブラウザ内保存'}</small>
            </button>
            <button className="link" onClick={() => void forgetRemembered().then(() => setRemembered(undefined))}>
              記憶を消す
            </button>
          </div>
        )}

        {fileOk ? (
          <div className="gate-actions">
            <button className="btn block" disabled={busy} onClick={() => run(pickExistingFile)}>
              既存の .sqlite ファイルを開く
            </button>
            <button className="btn block" disabled={busy} onClick={() => run(pickNewFile)}>
              新しいファイルを作成
            </button>
            <p className="note">OneDrive の同期フォルダ内に置くと、クラウドにも自動で保存されます。</p>
          </div>
        ) : (
          <p className="note warn">
            このブラウザはファイルの直接保存に未対応です (PC の Chrome / Edge で対応)。
            <br />
            スマホからの OneDrive 接続は Phase 3 で対応予定です。
          </p>
        )}

        <details className="gate-more">
          <summary>その他の保存方法</summary>
          <button className="btn block ghost" disabled={busy} onClick={() => run(useBrowserStorage)}>
            ブラウザ内に保存 (お試し・暫定)
          </button>
          <p className="note">ブラウザのデータを消すと失われます。設定画面からバックアップを取ってください。</p>
        </details>

        {error && <p className="note danger">{error}</p>}
      </div>
    </div>
  );
}
