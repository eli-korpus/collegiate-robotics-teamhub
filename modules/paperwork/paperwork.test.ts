import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules } from '../../tests/db/harness';

describe('paperwork', () => {
  it('members only see their own status; mentors mark', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['paperwork']), true);
    const mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    const a = await db.user('A', { [TEAM_A]: 'member' });
    const b = await db.user('B', { [TEAM_A]: 'member' });
    const [{ id }] = await db.as(mentor, `insert into ppr_items (name) values ('Consent') returning id`);
    await db.as(mentor, `insert into ppr_done (item_id, user_id) values ($1, $2), ($1, $3)`, [id, a, b]);
    expect((await db.as(a, 'select user_id from ppr_done')).map((r) => r.user_id)).toEqual([a]);
    expect(await db.denied(a, `delete from ppr_done where user_id = $1 returning user_id`, [a])).toBe(true);
  });
});
