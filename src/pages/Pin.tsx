import { useState } from 'react';
import { Emblem } from '../components/Emblem';
import { useApp } from '../state/AppContext';
import { isValidPin } from '../lib/pin';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export function Pin({ mode }: { mode: 'setup' | 'unlock' }) {
  const { setPin, unlock, disconnect, storage } = useApp();
  const [pin, setPinText] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const title = mode === 'unlock' ? 'PIN を入力' : first === null ? 'PIN を設定 (4〜8桁)' : 'もう一度入力';

  const submit = async (value = pin) => {
    if (busy) return;
    if (mode === 'unlock') {
      setBusy(true);
      const ok = await unlock(value);
      setBusy(false);
      if (!ok) {
        setMsg('PIN が違います');
        setPinText('');
      }
      return;
    }
    if (!isValidPin(value)) return setMsg('4〜8桁の数字で入力してください');
    if (first === null) {
      setFirst(value);
      setPinText('');
      setMsg('');
      return;
    }
    if (first !== value) {
      setFirst(null);
      setPinText('');
      return setMsg('一致しません。最初からやり直してください');
    }
    setBusy(true);
    await setPin(value);
  };

  const press = (k: string) => {
    setMsg('');
    if (k === '⌫') return setPinText((p) => p.slice(0, -1));
    if (!k || pin.length >= 8) return;
    setPinText(pin + k);
  };

  return (
    <div className="gate">
      <form
        className="gate-card panel pin"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Emblem size={72} />
        <p className="gate-sub">{title}</p>
        <input
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={8}
          value={pin}
          aria-label="PIN"
          onChange={(e) => {
            setMsg('');
            setPinText(e.target.value.replace(/\D/g, ''));
          }}
        />
        <div className="pin-dots" aria-hidden>
          {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
            <i key={i} className={i < pin.length ? 'on' : ''} />
          ))}
        </div>
        <p className="note danger pin-msg">{msg}</p>
        <div className="keypad">
          {KEYS.map((k, i) => (
            <button key={i} type="button" disabled={!k} onClick={() => press(k)}>
              {k}
            </button>
          ))}
        </div>
        <button className="btn primary block" disabled={busy || pin.length < 4}>
          {mode === 'unlock' ? 'ロック解除' : first === null ? '次へ' : '設定する'}
        </button>
        {mode === 'setup' && <p className="note">PIN は画面ロック用です (ファイル自体は暗号化されません)。</p>}
        <button type="button" className="link" onClick={disconnect}>
          別のデータを開く ({storage?.label})
        </button>
      </form>
    </div>
  );
}
