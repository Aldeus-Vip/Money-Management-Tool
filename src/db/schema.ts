import type { Database } from 'sql.js';

/**
 * スキーマのマイグレーション。DB ファイルの PRAGMA user_version で版を管理。
 * 追加時は配列の末尾に足すだけ (既存の要素は変更しない)。
 */
export const MIGRATIONS: string[] = [
  // v1: Phase 1
  `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE wallets (
    id     INTEGER PRIMARY KEY,
    name   TEXT NOT NULL UNIQUE,
    kind   TEXT NOT NULL CHECK (kind IN ('bank','debit','cash','emoney')),
    sort   INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE categories (
    code      TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    is_income INTEGER NOT NULL DEFAULT 0,
    sort      INTEGER NOT NULL
  );

  -- 用途マスタ。wallet_id が NULL なら全ウォレット共通の候補
  CREATE TABLE purposes (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    wallet_id     INTEGER REFERENCES wallets(id),
    category_code TEXT REFERENCES categories(code),
    is_charge     INTEGER NOT NULL DEFAULT 0,
    sort          INTEGER NOT NULL DEFAULT 0,
    active        INTEGER NOT NULL DEFAULT 1
  );

  -- 期間 (給料日起点)。ym = 給料日が属する年月
  CREATE TABLE periods (
    ym          TEXT PRIMARY KEY,
    start_date  TEXT NOT NULL,
    salary      INTEGER NOT NULL DEFAULT 0,
    bonus       INTEGER NOT NULL DEFAULT 0,
    bonus_on    INTEGER NOT NULL DEFAULT 0,
    food_budget INTEGER NOT NULL DEFAULT 0,
    charge_limit INTEGER NOT NULL DEFAULT 0,
    fun_limit   INTEGER NOT NULL DEFAULT 0,
    saving_move INTEGER NOT NULL DEFAULT 0,
    fun_move    INTEGER NOT NULL DEFAULT 0,
    extra_add   INTEGER NOT NULL DEFAULT 0,
    memo        TEXT
  );

  CREATE TABLE fixed_costs (
    id             INTEGER PRIMARY KEY,
    name           TEXT NOT NULL,
    withdraw_day   INTEGER,
    cycle_months   INTEGER NOT NULL DEFAULT 1,
    buffer         INTEGER NOT NULL DEFAULT 0,
    default_amount INTEGER NOT NULL DEFAULT 0,
    sort           INTEGER NOT NULL DEFAULT 0,
    active         INTEGER NOT NULL DEFAULT 1
  );

  -- 期間ごとの固定費 (予定額/実額)
  CREATE TABLE period_fixed_costs (
    ym            TEXT NOT NULL REFERENCES periods(ym) ON DELETE CASCADE,
    fixed_cost_id INTEGER NOT NULL REFERENCES fixed_costs(id),
    amount        INTEGER NOT NULL,
    paid          INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (ym, fixed_cost_id)
  );

  CREATE TABLE transactions (
    id            INTEGER PRIMARY KEY,
    date          TEXT NOT NULL,
    wallet_id     INTEGER NOT NULL REFERENCES wallets(id),
    category_code TEXT NOT NULL REFERENCES categories(code),
    purpose_id    INTEGER REFERENCES purposes(id),
    amount        INTEGER NOT NULL,
    memo          TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );
  CREATE INDEX idx_transactions_date ON transactions(date);

  INSERT INTO wallets (name, kind, sort) VALUES
    ('普通口座','bank',1), ('デビット','debit',2), ('現金','cash',3), ('PayPay','emoney',4), ('Suica','emoney',5);

  INSERT INTO categories (code, name, is_income, sort) VALUES
    ('food','食費',0,1), ('transport','交通費',0,2), ('fun','娯楽費',0,3),
    ('extra','臨時費用',0,4), ('other','その他',0,5), ('income','受取金',1,6);

  INSERT INTO purposes (name, wallet_id, category_code, is_charge, sort) VALUES
    ('コンビニ', NULL, 'food', 0, 1),
    ('スーパー', NULL, 'food', 0, 2),
    ('外食',     NULL, 'food', 0, 3),
    ('自販機',   NULL, 'food', 0, 4),
    ('電車',     NULL, 'transport', 0, 5),
    ('課金',     NULL, 'fun', 1, 6),
    ('本',       NULL, 'fun', 0, 7),
    ('ゲーム',   NULL, 'fun', 0, 8),
    ('日用品',   NULL, 'extra', 0, 9),
    ('受取',     NULL, 'income', 0, 10);

  INSERT INTO settings (key, value) VALUES
    ('payday_day','25'), ('payday_holidays','1'),
    ('fixed_buffer_rate','0.1'), ('avg_rate','1.05'), ('extra_min','5000');
  `,
  // v2: Phase 2 (残高・移動・プール・取り込み準備)
  `
  -- Excel 等からの取り込み単位。batch_id の付いた行は単位ごとに削除・やり直しできる
  CREATE TABLE import_batches (
    id          INTEGER PRIMARY KEY,
    source      TEXT NOT NULL,
    imported_at TEXT NOT NULL,
    note        TEXT
  );

  -- ウォレット間の移動 (出金・入金・チャージ)
  CREATE TABLE transfers (
    id             INTEGER PRIMARY KEY,
    date           TEXT NOT NULL,
    from_wallet_id INTEGER NOT NULL REFERENCES wallets(id),
    to_wallet_id   INTEGER NOT NULL REFERENCES wallets(id),
    amount         INTEGER NOT NULL,
    memo           TEXT,
    batch_id       INTEGER REFERENCES import_batches(id)
  );
  CREATE INDEX idx_transfers_date ON transfers(date);

  ALTER TABLE transactions ADD COLUMN batch_id INTEGER REFERENCES import_batches(id);
  -- 移動に付随する手数料の取引 (移動を消すと一緒に消す)
  ALTER TABLE transactions ADD COLUMN transfer_id INTEGER REFERENCES transfers(id);
  ALTER TABLE periods ADD COLUMN batch_id INTEGER REFERENCES import_batches(id);
  ALTER TABLE period_fixed_costs ADD COLUMN batch_id INTEGER REFERENCES import_batches(id);

  -- 期間ごとのウォレット残高: 期首 (給料前) と実残高 (不明金チェック用)
  CREATE TABLE period_balances (
    ym        TEXT NOT NULL,
    wallet_id INTEGER NOT NULL REFERENCES wallets(id),
    opening   INTEGER NOT NULL DEFAULT 0,
    actual    INTEGER,
    batch_id  INTEGER REFERENCES import_batches(id),
    PRIMARY KEY (ym, wallet_id)
  );

  -- 貯金・娯楽費プール。毎期間の移動額は periods.saving_move / fun_move
  CREATE TABLE pools (
    id   INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0
  );
  -- kind: adjust = 残高の調整 (初期残高など) / use = プールからの使用 (口座に戻り自由枠に加算)
  CREATE TABLE pool_entries (
    id       INTEGER PRIMARY KEY,
    pool_id  INTEGER NOT NULL REFERENCES pools(id),
    date     TEXT NOT NULL,
    kind     TEXT NOT NULL CHECK (kind IN ('adjust','use')),
    amount   INTEGER NOT NULL,
    purpose  TEXT,
    memo     TEXT,
    batch_id INTEGER REFERENCES import_batches(id)
  );

  -- 取引明細が無く集計値だけ残っている月の実績 (Excel「費用実績」の取り込み先)
  -- item 例: 'fixed:家賃', 'cat:food', 'income:salary', 'move:saving'
  CREATE TABLE monthly_actuals (
    ym       TEXT NOT NULL,
    item     TEXT NOT NULL,
    amount   INTEGER NOT NULL,
    batch_id INTEGER REFERENCES import_batches(id),
    PRIMARY KEY (ym, item)
  );

  INSERT INTO pools (code, name, sort) VALUES ('saving','貯金',1), ('fun','娯楽費',2);
  INSERT INTO purposes (name, wallet_id, category_code, is_charge, sort)
    SELECT '手数料', NULL, 'other', 0, COALESCE(MAX(sort),0)+1 FROM purposes WHERE NOT EXISTS (SELECT 1 FROM purposes WHERE name = '手数料');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('carry_opening','0');
  `,
  // v3: 固定費の算出方法 (固定額 / 過去平均) と、期間ごとの予算額・引落額 (NULL = マスタから自動)
  `
  ALTER TABLE fixed_costs ADD COLUMN mode TEXT NOT NULL DEFAULT 'fixed' CHECK (mode IN ('fixed','average'));
  ALTER TABLE period_fixed_costs ADD COLUMN planned INTEGER;
  ALTER TABLE period_fixed_costs ADD COLUMN actual INTEGER;
  -- 既存データは入力済みの金額を手入力として保持
  UPDATE period_fixed_costs SET planned = amount, actual = amount;
  UPDATE fixed_costs SET mode = 'average' WHERE buffer = 1;
  INSERT OR IGNORE INTO settings (key, value) VALUES ('bento_price','400');
  `,
  // v4: 固定費の請求月 (年1回・隔月など) と金額の予定 (以降ずっと / 毎年この月 / その月だけ)
  `
  ALTER TABLE fixed_costs ADD COLUMN bill_months TEXT;  -- NULL = 毎月 / '2,4,6,8,10,12' のように請求する月
  CREATE TABLE fixed_cost_rules (
    id            INTEGER PRIMARY KEY,
    fixed_cost_id INTEGER NOT NULL REFERENCES fixed_costs(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL CHECK (kind IN ('from','yearly','once')),
    ym            TEXT,     -- from: 開始年月 / once: 対象年月 / yearly: 開始年月 (任意)
    month         INTEGER,  -- yearly: 対象の月 (1〜12)
    amount        INTEGER NOT NULL,
    note          TEXT
  );
  CREATE INDEX idx_fixed_cost_rules ON fixed_cost_rules(fixed_cost_id);
  `,
  // v5: 予定 (通院日など)。中身は DB にだけ保存され、アプリのコードには含まれない
  `
  CREATE TABLE reminders (
    id    INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    date  TEXT NOT NULL,
    time  TEXT,          -- 'HH:MM' (任意)
    memo  TEXT
  );
  CREATE INDEX idx_reminders_date ON reminders(date);
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export function migrate(db: Database): void {
  const cur = Number(db.exec('PRAGMA user_version')[0].values[0][0]);
  if (cur > SCHEMA_VERSION) {
    throw new Error(`DB の版 (v${cur}) がアプリ (v${SCHEMA_VERSION}) より新しいため開けません。アプリを更新してください。`);
  }
  for (let v = cur; v < SCHEMA_VERSION; v++) {
    db.run('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.run(`PRAGMA user_version = ${v + 1}`);
      db.run('COMMIT');
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }
  }
}
