import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules, type TestDb } from '../../tests/db/harness';

describe('checklists', () => {
  let db: TestDb;
  let captain: string, member: string;
  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(withModules(['checklists']), true);
    captain = await db.user('Captain', { [TEAM_A]: 'captain' });
    member = await db.user('Member', { [TEAM_A]: 'member' });
  });
  it('captains manage lists; members run them; toggling completes the run', async () => {
    expect(await db.denied(member, `insert into chk_lists (name) values ('x')`)).toBe(true);
    const [{ id: list }] = await db.as(captain, `insert into chk_lists (name, items) values ('Pre-match', '[{"id":"a","text":"Battery"},{"id":"b","text":"Wheels"}]') returning id`);
    const [{ id: run }] = await db.as(member, `insert into chk_runs (list_id, started_by) values ($1, $2) returning id`, [list, member]);
    await db.as(member, `select chk_toggle($1, 'a', true)`, [run]);
    await db.as(captain, `select chk_toggle($1, 'b', true)`, [run]);
    const [r] = await db.admin('select checked, completed_at from chk_runs where id = $1', [run]);
    expect(r.checked.sort()).toEqual(['a', 'b']);
    expect(r.completed_at).toBeTruthy();
    await db.as(member, `select chk_toggle($1, 'a', false)`, [run]);
    expect((await db.admin('select completed_at from chk_runs where id = $1', [run]))[0].completed_at).toBeNull();
  });
});
