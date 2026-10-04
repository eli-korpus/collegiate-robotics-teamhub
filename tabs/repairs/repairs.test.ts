import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules } from '../../tools/tests/db/harness';

describe('repairs', () => {
  it('members report and edit their own; captains manage all; delete cleans comments and photo', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['repairs']), true);
    const captain = await db.user('Captain', { [TEAM_A]: 'captain' });
    const member = await db.user('Member', { [TEAM_A]: 'member' });
    const other = await db.user('Other', { [TEAM_A]: 'member' });
    const [{ id }] = await db.as(member, `insert into rep_issues (title, reported_by, image_path) values ('Belt snapped', $1, 'p/i/x.webp') returning id`, [member]);
    expect(await db.denied(other, `update rep_issues set status = 'fixed' where id = $1 returning id`, [id])).toBe(true);
    await db.as(other, `insert into comments (ref, author, body) values ($1, $2, 'Use the 9mm belt')`, [`repairs:issue:${id}`, other]);
    await db.as(captain, `update rep_issues set status = 'fixed', fixed_by = $2 where id = $1`, [id, captain]);
    await db.as(captain, `delete from rep_issues where id = $1`, [id]);
    expect(await db.admin('select * from comments')).toEqual([]);
    expect((await db.admin('select path from teamhub_storage_trash')).map((r) => r.path)).toContain('p/i/x.webp');
  });
});
