import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, TEAM_B, testConfig, type TestDb } from './harness';

/** Profile fields: everyone, team leaders (shirt sizes) or mentors (emergency contacts). */
describe('who can see profile fields', () => {
  let db: TestDb;
  let admin: string, mentorA: string, captainA: string, captainB: string, memberA: string, otherA: string;
  const readLeaders = (who: string, of: string) => db.as(who, 'select data from profiles_leaders where user_id = $1', [of]);
  const readPrivate = (who: string, of: string) => db.as(who, 'select data from profiles_private where user_id = $1', [of]);

  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(testConfig(), true);
    admin = await db.user('Admin', { [TEAM_A]: 'mentor' }, { admin: true });
    mentorA = await db.user('MentorA', { [TEAM_A]: 'mentor' });
    captainA = await db.user('CaptainA', { [TEAM_A]: 'captain' });
    captainB = await db.user('CaptainB', { [TEAM_B]: 'captain' });
    memberA = await db.user('MemberA', { [TEAM_A]: 'member' });
    otherA = await db.user('OtherA', { [TEAM_A]: 'member' });
    await db.as(memberA, `insert into profiles_leaders (user_id, data) values ($1, '{"shirt_size":"M"}')`, [memberA]);
    await db.as(memberA, `insert into profiles_private (user_id, data) values ($1, '{"emergency_contact":"Parent 555-0100"}')`, [memberA]);
  }, 120_000);

  it('team-only fields: the person, captains and mentors on their team, and admins', async () => {
    expect(await readLeaders(memberA, memberA)).toEqual([{ data: { shirt_size: 'M' } }]);
    expect(await readLeaders(captainA, memberA)).toHaveLength(1);
    expect(await readLeaders(mentorA, memberA)).toHaveLength(1);
    expect(await readLeaders(admin, memberA)).toHaveLength(1);
    expect(await readLeaders(otherA, memberA)).toEqual([]);
    expect(await readLeaders(captainB, memberA)).toEqual([]);
  });

  it('private fields stay mentors-only: captains can not see them', async () => {
    expect(await readPrivate(mentorA, memberA)).toHaveLength(1);
    expect(await readPrivate(captainA, memberA)).toEqual([]);
    expect(await readPrivate(otherA, memberA)).toEqual([]);
  });

  it('captains can fill in a missing shirt size, other members can not', async () => {
    await db.as(captainA, `update profiles_leaders set data = '{"shirt_size":"L"}' where user_id = $1`, [memberA]);
    expect((await readLeaders(memberA, memberA))[0].data).toEqual({ shirt_size: 'L' });
    expect(await db.denied(otherA, `update profiles_leaders set data = '{"shirt_size":"XS"}' where user_id = $1 returning user_id`, [memberA])).toBe(true);
    expect(await db.denied(captainB, `insert into profiles_leaders (user_id, data) values ($1, '{}')`, [otherA])).toBe(true);
  });

  it('the old Request info table is closed (the Setup assistant on Home replaced it)', async () => {
    expect(await db.denied(mentorA, `insert into info_requests (fields, team_id, created_by) values ('{shirt_size}', $1, $2)`, [TEAM_A, mentorA])).toBe(true);
    expect(await db.denied(admin, `insert into info_requests (fields, team_id, created_by) values ('{shirt_size}', $1, $2)`, [TEAM_A, admin])).toBe(true);
  });

  it('changing a field\'s level moves the answers (and only the database update can do it)', async () => {
    await db.as(otherA, `update profiles set details = '{"shirt_size":"S","grade":"10"}' where id = $1`, [otherA]);
    const field = (visibility: 'everyone' | 'leaders' | 'mentors') => ({ profileFields: [{ id: 'shirt_size', label: 'Shirt size', type: 'text' as const, visibility }] });
    await db.applyConfig(testConfig(field('leaders')));
    expect((await db.admin('select details from profiles where id = $1', [otherA]))[0].details).toEqual({ grade: '10' });
    expect((await readLeaders(captainA, otherA))[0].data).toEqual({ shirt_size: 'S' });
    expect((await readLeaders(memberA, memberA))[0].data).toEqual({ shirt_size: 'L' });
    await db.applyConfig(testConfig(field('mentors')));
    expect(await readLeaders(captainA, otherA)).toEqual([{ data: {} }]);
    expect((await readPrivate(mentorA, otherA))[0].data).toEqual({ shirt_size: 'S' });
    expect(await db.denied(admin, `select teamhub_place_profile_field('shirt_size', 'everyone')`)).toBe(true);
  });
});
