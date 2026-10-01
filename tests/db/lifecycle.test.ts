import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules, type TestDb } from './harness';

/** Add/remove cycles (spec §16.2): integrations, dormant tabs and deleted tabs. */
describe('module lifecycle', () => {
  let db: TestDb;
  let admin: string, member: string;

  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(withModules(['attendance', 'calendar']), true);
    admin = await db.user('Admin', { [TEAM_A]: 'mentor' }, { admin: true });
    member = await db.user('Member', { [TEAM_A]: 'member' });
    await db.admin(`insert into att_sessions (team_id, title) values ($1, 'Kept practice')`, [TEAM_A]);
  });

  const cols = async () => (await db.admin(`select column_name from information_schema.columns where table_name = 'att_sessions'`)).map((r) => r.column_name);

  it('installs integration columns only when both modules exist', async () => {
    expect(await cols()).toContain('calendar_event_id');
    const mods = (await db.admin('select id from teamhub_modules order by id')).map((r) => r.id);
    expect(mods).toEqual(['attendance', 'attendance+calendar', 'calendar', 'core']);
  });

  it('dormant: data stays, members lose access, admins can read', async () => {
    const cfg = withModules(['attendance', 'calendar']);
    cfg.modules.attendance.state = 'dormant';
    await db.applyConfig(cfg);
    expect(await db.as(member, 'select * from att_sessions')).toEqual([]);
    expect((await db.as(admin, 'select title from att_sessions')).map((r) => r.title)).toEqual(['Kept practice']);
    expect(await db.denied(admin, `insert into att_sessions (team_id) values ($1)`, [TEAM_A])).toBe(true);
    // integration stays installed while a side is only dormant
    expect(await cols()).toContain('calendar_event_id');
  });

  it('re-activating restores everything instantly', async () => {
    await db.applyConfig(withModules(['attendance', 'calendar']));
    expect((await db.as(member, 'select title from att_sessions')).map((r) => r.title)).toEqual(['Kept practice']);
  });

  it('deleting a tab drops its objects and tears down integrations; the other tab keeps its data', async () => {
    await db.applyConfig(withModules(['attendance']));
    const tables = (await db.admin(`select tablename from pg_tables where schemaname = 'public' and tablename like 'cal\\_%'`)).length;
    expect(tables).toBe(0);
    expect(await cols()).not.toContain('calendar_event_id');
    expect((await db.as(member, 'select title from att_sessions')).map((r) => r.title)).toEqual(['Kept practice']);
    const fns = await db.admin(`select proname from pg_proc where proname like 'cal\\_%'`);
    expect(fns).toEqual([]);
    expect((await db.admin('select id from teamhub_modules order by id')).map((r) => r.id)).toEqual(['attendance', 'core']);
  });

  it('re-adding a deleted tab starts fresh', async () => {
    await db.applyConfig(withModules(['attendance', 'calendar']));
    expect(await db.admin('select * from cal_events')).toEqual([]);
    expect(await cols()).toContain('calendar_event_id');
  });
});
