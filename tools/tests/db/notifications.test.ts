import { describe, expect, it } from 'vitest';
import { catalogBefore, createTestDb, TEAM_A, testConfig, withModules } from './harness';

/** Every notification names who caused it: the bell shows "<name> assigned you a task", never "TeamHub …" (010). */
describe('notification names', () => {
  it('names the person behind a change, and sends nothing for changes nobody made (backups, scripts)', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['tasks']), true);
    const mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    const member = await db.user('Member', { [TEAM_A]: 'member' });
    await db.as(mentor, `insert into task_items (team_id, title, assignee, created_by) values ($1, 'Wire the arm', array[$2]::uuid[], $3)`, [TEAM_A, member, mentor]);
    expect(await db.as(member, `select type, actor from notifications`)).toEqual([{ type: 'tasks.assigned', actor: mentor }]);
    // Like restoring a backup: no one is signed in, so no one is notified.
    await db.admin(`insert into task_items (team_id, title, assignee) values ($1, 'Restored task', array[$2]::uuid[])`, [TEAM_A, member]);
    expect((await db.admin(`select count(*)::int n from notifications where actor is null`))[0].n).toBe(0);
  }, 120_000);

  it('updating names the join requests that were sent without a name', async () => {
    const before = await catalogBefore('010_');
    const db = await createTestDb();
    await db.applyConfig(testConfig(), true, before);
    await db.user('Captain', { [TEAM_A]: 'captain' });
    const asker = await db.signUp('new@x.dev', { name: 'New Person', teams: [TEAM_A], requested_type: 'member' });
    expect(await db.admin(`select distinct actor from notifications where type = 'people.request'`)).toEqual([{ actor: null }]);
    await db.applyConfig(testConfig());
    expect(await db.admin(`select distinct actor from notifications where type = 'people.request'`)).toEqual([{ actor: asker }]);
  }, 120_000);
});
