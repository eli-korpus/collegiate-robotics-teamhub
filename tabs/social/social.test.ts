import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules } from '../../tools/tests/db/harness';

describe('social', () => {
  it('only approvers schedule; caption edits by others send it back for approval', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['social']), true);
    const mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    const a = await db.user('A', { [TEAM_A]: 'member' });
    const [{ id }] = await db.as(a, `insert into soc_posts (team_id, caption, status, created_by) values ($1, 'Robot reveal!', 'approval', $2) returning id`, [TEAM_A, a]);
    await expect(db.as(a, `update soc_posts set status = 'scheduled' where id = $1`, [id])).rejects.toThrow(/approvers/);
    await db.as(mentor, `update soc_posts set status = 'scheduled', scheduled_for = now() + interval '1 day' where id = $1`, [id]);
    expect((await db.as(a, 'select approved_by from soc_posts'))[0].approved_by).toBe(mentor);
    await db.as(a, `update soc_posts set caption = 'Robot reveal!!' where id = $1`, [id]);
    expect((await db.as(a, 'select status, approved_by from soc_posts'))[0]).toEqual({ status: 'approval', approved_by: null });
    await expect(db.as(a, `update soc_posts set status = 'posted' where id = $1`, [id])).rejects.toThrow(/posted/);
  });
});
