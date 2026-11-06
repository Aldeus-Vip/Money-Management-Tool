import { describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { openDb } from '../src/db/sqlite';
import { MIGRATIONS, SCHEMA_VERSION } from '../src/db/schema';
import * as repo from '../src/db/repo';

describe('reminders (予定)', () => {
  it('lists upcoming reminders in date/time order and deletes', async () => {
    const db = await openDb(null);
    repo.saveReminder(db, { title: '予定B', date: '2026-11-21', time: '14:30', memo: null });
    repo.saveReminder(db, { title: '予定A', date: '2026-11-10', time: null, memo: null });
    const old = repo.saveReminder(db, { title: '過去', date: '2026-10-01', time: null, memo: null });
    expect(repo.listReminders(db, '2026-11-06').map((r) => r.title)).toEqual(['予定A', '予定B']);
    repo.deleteReminder(db, old);
    expect(repo.listReminders(db)).toHaveLength(2);
  });

  it('migrates a v4 database to the latest version', async () => {
    const SQL = await initSqlJs();
    const v4 = new SQL.Database();
    for (const m of MIGRATIONS.slice(0, 4)) v4.exec(m);
    v4.run('PRAGMA user_version = 4');
    const db = await openDb(v4.export());
    expect(Number(db.exec('PRAGMA user_version')[0].values[0][0])).toBe(SCHEMA_VERSION);
    expect(repo.listReminders(db)).toEqual([]);
  });
});
