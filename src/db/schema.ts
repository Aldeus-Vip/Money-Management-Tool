import type { Database } from 'sql.js';

/**
 * スキーマのマイグレーション。DB ファイルの PRAGMA user_version で版を管理。
 * 追加時は配列の末尾に足すだけ (既存の要素は変更しない)。
 */
const MIGRATIONS: string[] = [
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
