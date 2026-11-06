import type { IconName } from '../components/Icon';
import type { Wallet } from '../db/repo';

/**
 * 色とアイコン (Excel の色分けをダークテーマ向けに調整)。
 * 変えたいときはここだけ変更すれば全画面に反映される。
 */
export interface Visual { color: string; icon: IconName }

export const VISUAL = {
  bank: { color: '#5BA4E6', icon: 'bank' },
  debit: { color: '#8FA6C8', icon: 'card' },
  cash: { color: '#A6D96A', icon: 'cash' },
  paypay: { color: '#FF5A6A', icon: 'phone' },
  suica: { color: '#3CC879', icon: 'iccard' },
  emoney: { color: '#E08BD8', icon: 'phone' },
  savings: { color: '#3D7BEA', icon: 'piggy' },
  saving: { color: '#3D7BEA', icon: 'piggy' },
  funPool: { color: '#C15CFF', icon: 'piggy' },
  free: { color: '#19E3E8', icon: 'spark' },
  food: { color: '#86D27E', icon: 'food' },
  charge: { color: '#F4A06B', icon: 'gem' },
  fun: { color: '#9FB0E0', icon: 'game' },
  extra: { color: '#F5C84B', icon: 'umbrella' },
} satisfies Record<string, Visual>;

/** ウォレットの色とアイコン (電子マネーは名前で PayPay / Suica を判定) */
export function walletVisual(w: Pick<Wallet, 'kind' | 'name'>): Visual {
  if (w.kind === 'bank') return VISUAL.bank;
  if (w.kind === 'debit') return VISUAL.debit;
  if (w.kind === 'cash') return VISUAL.cash;
  if (/paypay/i.test(w.name)) return VISUAL.paypay;
  if (/suica|pasmo|icoca/i.test(w.name)) return VISUAL.suica;
  return VISUAL.emoney;
}

export const poolVisual = (code: string): Visual => (code === 'saving' ? VISUAL.saving : VISUAL.funPool);

/** 要素に付けるアクセント色 (CSS 変数 --accent) */
export const accent = (v: Visual) => ({ ['--accent' as string]: v.color });
