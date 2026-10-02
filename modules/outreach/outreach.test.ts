import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules } from '../../tests/db/harness';

describe('outreach', () => {
  it('members log hours unapproved; only approvers approve; edits need re-approval', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['outreach']), true);
    const mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    const a = await db.user('A', { [TEAM_A]: 'member' });
    const [{ id }] = await db.as(mentor, `insert into out_events (team_id, title, date, kind, people_reached, created_by) values ($1, 'Library demo', current_date, 'Demo', 40, $2) returning id`, [TEAM_A, mentor]);
    await db.as(a, `insert into out_hours (event_id, user_id, hours, approved) values ($1, $2, 3, true)`, [id, a]);
    expect((await db.as(a, 'select approved from out_hours'))[0].approved).toBe(false);
    await db.as(mentor, `update out_hours set approved = true where event_id = $1`, [id]);
    expect((await db.as(a, 'select approved, approved_by from out_hours'))[0]).toEqual({ approved: true, approved_by: mentor });
    await db.as(a, `update out_hours set hours = 4 where event_id = $1`, [id]);
    expect((await db.as(a, 'select approved from out_hours'))[0].approved).toBe(false);
    const b = await db.user('B', { [TEAM_A]: 'member' });
    expect(await db.denied(b, `update out_hours set hours = 1 where event_id = $1 returning *`, [id])).toBe(true);
  });
});
