import type { Period, PeriodBalance, PeriodFixedCost, Transaction, Transfer, Wallet } from '../db/repo';

/**
 * ウォレット残高の計算 (Excel「銀行口座」「現金」「PayPay」「Suica」シート)。
 *
 * 普通口座 (現在) = 期首 + 給料 + 賞与(ON) − 引落済の固定費 − プールへの移動 + プールからの使用
 *                  ± 移動 − 支出 (口座・デビット) + 受取金 (振込)
 * 普通口座 (見込み) = 現在 − 未引落の固定費
 * その他          = 期首 ± 移動 − 支出 + 受取金
 * 不明金          = 計算残高 − 実残高   (+ = 使途不明 / − = 記録漏れの収入)
 */
export interface WalletBalance {
  wallet: Wallet;
  opening: number;
  /** 期首からの増減の内訳 */
  income: number;      // 給料 + 賞与 (口座のみ)
  fixedPaid: number;   // 引落済の固定費 (口座のみ)
  fixedUnpaid: number; // 未引落の固定費 (口座のみ)
  poolMove: number;    // プールへの移動 (口座のみ)
  poolUse: number;     // プールからの使用 (口座のみ)
  transferIn: number;
  transferOut: number;
  spent: number;
  received: number;
  current: number;
  projected: number;
  actual: number | null;
  /** 計算 − 実残高 (実残高が未入力なら null) */
  unknown: number | null;
  /** デビットは口座に合算されるため単独の残高を持たない */
  merged: boolean;
}

export interface BalanceInput {
  wallets: Wallet[];
  balances: Map<number, PeriodBalance>;
  period: Period | null;
  txs: Transaction[];
  transfers: Transfer[];
  fixed: PeriodFixedCost[];
  poolUse: number;
}

export function computeBalances(i: BalanceInput): WalletBalance[] {
  const bank = i.wallets.find((w) => w.kind === 'bank');
  const debitIds = new Set(i.wallets.filter((w) => w.kind === 'debit').map((w) => w.id));
  // デビットの取引は口座の取引として扱う
  const owner = (walletId: number) => (debitIds.has(walletId) && bank ? bank.id : walletId);

  return i.wallets.map((w) => {
    const merged = w.kind === 'debit' && !!bank;
    const isBank = w.id === bank?.id;
    const mine = i.txs.filter((t) => owner(t.wallet_id) === w.id);
    const spent = mine.filter((t) => t.category_code !== 'income').reduce((s, t) => s + t.amount, 0);
    const received = mine.filter((t) => t.category_code === 'income').reduce((s, t) => s + t.amount, 0);
    const transferIn = i.transfers.filter((t) => t.to_wallet_id === w.id).reduce((s, t) => s + t.amount, 0);
    const transferOut = i.transfers.filter((t) => t.from_wallet_id === w.id).reduce((s, t) => s + t.amount, 0);
    const p = i.period;
    const income = isBank && p ? p.salary + (p.bonus_on ? p.bonus : 0) : 0;
    const fixedPaid = isBank ? i.fixed.filter((f) => f.paid).reduce((s, f) => s + f.amount, 0) : 0;
    const fixedUnpaid = isBank ? i.fixed.filter((f) => !f.paid).reduce((s, f) => s + f.amount, 0) : 0;
    const poolMove = isBank && p ? p.saving_move + p.fun_move : 0;
    const poolUse = isBank ? i.poolUse : 0;
    const b = i.balances.get(w.id);
    const opening = merged ? 0 : (b?.opening ?? 0);
    const current = merged ? 0 : opening + income - fixedPaid - poolMove + poolUse + transferIn - transferOut - spent + received;
    const actual = merged ? null : (b?.actual ?? null);
    return {
      wallet: w, opening, income, fixedPaid, fixedUnpaid, poolMove, poolUse, transferIn, transferOut, spent, received,
      current, projected: current - fixedUnpaid, actual, unknown: actual === null ? null : current - actual, merged,
    };
  });
}

/** 前期間の残高 → 今期間の期首の候補 (実残高があればそれ、なければ計算残高) */
export function carryCandidates(prev: WalletBalance[]): Map<number, number> {
  return new Map(prev.filter((b) => !b.merged).map((b) => [b.wallet.id, b.actual ?? b.current]));
}
