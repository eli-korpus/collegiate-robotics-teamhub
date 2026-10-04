import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules } from '../../tools/tests/db/harness';

describe('skills', () => {
  it('sign-offs need sign_off permission and are never self-granted', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['skills']), true);
    const mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    const cap = await db.user('Cap', { [TEAM_A]: 'captain' });
    const a = await db.user('A', { [TEAM_A]: 'member' });
    expect(await db.denied(cap, `insert into skill_skills (team_id, name) values ($1, 'Drill press')`, [TEAM_A])).toBe(true);
    const [{ id }] = await db.as(mentor, `insert into skill_skills (team_id, name, category) values ($1, 'Drill press', 'Safety') returning id`, [TEAM_A]);
    expect(await db.denied(a, `insert into skill_signoffs (skill_id, user_id, signed_by) values ($1, $2, $2)`, [id, a])).toBe(true);
    expect(await db.denied(cap, `insert into skill_signoffs (skill_id, user_id, signed_by) values ($1, $2, $2)`, [id, cap])).toBe(true);
    await db.as(cap, `insert into skill_signoffs (skill_id, user_id, signed_by) values ($1, $2, $3)`, [id, a, cap]);
    expect((await db.as(a, 'select * from skill_signoffs')).length).toBe(1);
  });
});
