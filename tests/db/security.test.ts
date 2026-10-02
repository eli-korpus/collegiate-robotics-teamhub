import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, TEAM_B, withModules, type TestDb } from './harness';

/** Regression tests for the v1 security review: privilege escalation, data exposure and integrity holes. */
describe('security review', () => {
  let db: TestDb;
  let admin: string, mentorA: string, mentorA2: string, mentorB: string, captainA: string, memberA: string, memberBoth: string;
  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(withModules(['polls', 'rules', 'scouting', 'repairs', 'inventory']), true);
    admin = await db.user('Admin', { [TEAM_A]: 'mentor' }, { admin: true });
    mentorA = await db.user('MentorA', { [TEAM_A]: 'mentor' });
    mentorA2 = await db.user('MentorA2', { [TEAM_A]: 'mentor' });
    mentorB = await db.user('MentorB', { [TEAM_B]: 'mentor' });
    captainA = await db.user('CaptainA', { [TEAM_A]: 'captain' });
    memberA = await db.user('MemberA', { [TEAM_A]: 'member' });
    memberBoth = await db.user('MemberBoth', { [TEAM_A]: 'member', [TEAM_B]: 'member' });
  }, 120_000);

  it('client roles cannot TRUNCATE (it would bypass RLS) or list permission holders', async () => {
    await expect(db.as(memberA, 'truncate profiles cascade')).rejects.toThrow();
    await expect(db.as(memberA, `select teamhub_users_with('people.deactivate', null)`)).rejects.toThrow();
  });

  it('approval only works on pending requests (no demoting or reviving through it)', async () => {
    await expect(db.as(captainA, `select people_approve($1, $2, 'member')`, [mentorA, TEAM_A])).rejects.toThrow(/No pending request/);
  });

  it('nobody but an admin can change a mentor’s type, deactivate, reset or delete them', async () => {
    await expect(db.as(captainA, `select people_set_type($1, $2, 'member')`, [mentorA, TEAM_A])).rejects.toThrow();
    await expect(db.as(mentorA2, `select people_set_type($1, $2, 'member')`, [mentorA, TEAM_A])).rejects.toThrow();
    await expect(db.as(mentorA2, `select people_set_active($1, $2, false)`, [mentorA, TEAM_A])).rejects.toThrow();
    expect((await db.as(mentorA2, 'select people_can_reset_password($1) ok', [mentorA]))[0].ok).toBe(false);
    expect((await db.as(mentorA2, 'select people_can_delete_user($1) ok', [mentorA]))[0].ok).toBe(false);
    expect((await db.as(admin, 'select people_can_reset_password($1) ok', [mentorA]))[0].ok).toBe(true);
    // Mentors still manage members and captains on their team.
    expect((await db.as(mentorA, 'select people_can_reset_password($1) ok', [memberA]))[0].ok).toBe(true);
    await db.as(mentorA, `select people_set_type($1, $2, 'captain')`, [memberA, TEAM_A]);
    await db.as(mentorA, `select people_set_type($1, $2, 'member')`, [memberA, TEAM_A]);
  });

  it('a mentor of one team cannot deactivate or delete someone who is also on another team', async () => {
    await expect(db.as(mentorA, `select people_set_active($1, null, false)`, [memberBoth])).rejects.toThrow();
    expect((await db.as(mentorA, 'select people_can_delete_user($1) ok', [memberBoth]))[0].ok).toBe(false);
    expect((await db.as(mentorB, 'select people_can_reset_password($1) ok', [memberA]))[0].ok).toBe(false);
    await db.as(mentorA, `select people_set_active($1, $2, false)`, [memberBoth, TEAM_A]);
    expect((await db.admin('select status from memberships where user_id = $1 and team_id = $2', [memberBoth, TEAM_B]))[0].status).toBe('active');
  });

  it('nobody can move their private profile row onto someone else', async () => {
    await db.as(memberA, `insert into profiles_private (user_id, data) values ($1, '{"emergency_contact":"x"}')`, [memberA]);
    expect(await db.denied(memberA, 'update profiles_private set user_id = $1 where user_id = $2 returning user_id', [captainA, memberA])).toBe(true);
  });

  it('a poll cannot be made less private or moved to another team after people answered', async () => {
    const [{ id }] = await db.as(captainA, `insert into poll_polls (kind, question, options, visibility, created_by) values ('choice', 'How are you?', '["ok","bad"]', 'private', $1) returning id`, [captainA]);
    await db.as(memberA, `insert into poll_votes (poll_id, user_id, value) values ($1, $2, '[1]')`, [id, memberA]);
    await expect(db.as(captainA, `update poll_polls set visibility = 'public' where id = $1`, [id])).rejects.toThrow(/more private/);
    await expect(db.as(captainA, `update poll_polls set team_id = $2 where id = $1`, [id, TEAM_B])).rejects.toThrow();
    await db.as(captainA, `update poll_polls set closes_at = now() where id = $1`, [id]);
  });

  it('only rule answerers can write an official answer', async () => {
    expect(await db.denied(memberA, `insert into rule_items (kind, title, answer, created_by) values ('question', 'Q?', 'Yes, legal', $1)`, [memberA])).toBe(true);
    const [{ id }] = await db.as(memberA, `insert into rule_items (kind, title, created_by) values ('question', 'Is this legal?', $1) returning id`, [memberA]);
    expect(await db.denied(memberA, `update rule_items set answer = 'Totally legal' where id = $1 returning id`, [id])).toBe(true);
  });

  it('scouts cannot reassign their entries to someone else', async () => {
    const [{ id }] = await db.as(memberA, `insert into sct_entries (event_code, team_number, scout) values ('USX', 1, $1) returning id`, [memberA]);
    expect(await db.denied(memberA, 'update sct_entries set scout = $1 where id = $2 returning id', [captainA, id])).toBe(true);
  });

  it('using parts on a repair needs a positive quantity of the same team’s part', async () => {
    const [{ id: issue }] = await db.as(mentorA, `insert into rep_issues (team_id, title, reported_by) values ($1, 'Broken arm', $2) returning id`, [TEAM_A, mentorA]);
    const [{ id: partB }] = await db.as(mentorB, `insert into inv_items (team_id, name, qty) values ($1, 'B part', 10) returning id`, [TEAM_B]);
    const [{ id: partA }] = await db.as(mentorA, `insert into inv_items (team_id, name, qty) values ($1, 'A part', 10) returning id`, [TEAM_A]);
    await expect(db.as(mentorA, 'select ix_repinv_use($1, $2, 1)', [issue, partB])).rejects.toThrow(/another team/);
    await expect(db.as(mentorA, 'select ix_repinv_use($1, $2, -5)', [issue, partA])).rejects.toThrow(/Quantity/);
    await db.as(mentorA, 'select ix_repinv_use($1, $2, 2)', [issue, partA]);
    expect((await db.admin('select qty from inv_items where id = $1', [partA]))[0].qty).toBe(8);
  });
});

describe('changing which teams someone is on', () => {
  it('admins and approvers add, move and remove people between teams, within their rank', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules([]), true);
    const admin = await db.user('Admin', { [TEAM_A]: 'mentor' }, { admin: true });
    const mentorB = await db.user('MentorB', { [TEAM_B]: 'mentor' });
    const captainA = await db.user('CaptainA', { [TEAM_A]: 'captain' });
    const student = await db.user('Student', { [TEAM_A]: 'member' });
    const otherMentor = await db.user('OtherMentor', { [TEAM_A]: 'mentor' });

    // Move a student from A to B: add to B, then remove from A.
    await db.as(admin, `select people_add_to_team($1, $2, 'member')`, [student, TEAM_B]);
    await db.as(admin, 'select people_remove_from_team($1, $2)', [student, TEAM_A]);
    expect((await db.admin('select team_id from memberships where user_id = $1', [student])).map((r) => r.team_id)).toEqual([TEAM_B]);
    // Can't remove their last team (deactivate instead).
    await expect(db.as(admin, 'select people_remove_from_team($1, $2)', [student, TEAM_B])).rejects.toThrow(/only team/);
    // A team's mentor can add members to their team; a captain can't add a captain, and nobody but admins manages mentors.
    await db.as(mentorB, `select people_add_to_team($1, $2, 'member')`, [captainA, TEAM_B]);
    await expect(db.as(captainA, `select people_add_to_team($1, $2, 'captain')`, [student, TEAM_A])).rejects.toThrow();
    await expect(db.as(mentorB, `select people_add_to_team($1, $2, 'member')`, [otherMentor, TEAM_B])).rejects.toThrow();
    await expect(db.as(mentorB, 'select people_remove_from_team($1, $2)', [captainA, TEAM_A])).rejects.toThrow();
    // Members can't add themselves to teams.
    await expect(db.as(student, `select people_add_to_team($1, $2, 'member')`, [student, TEAM_A])).rejects.toThrow();
  });
});

describe('editing other people’s profiles', () => {
  it('mentors fix names and fill private fields for their team; members cannot', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules([]), true);
    const mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    const student = await db.user('Studnet', { [TEAM_A]: 'member' });
    const other = await db.user('Other', { [TEAM_B]: 'member' });
    await db.as(mentor, `update profiles set display_name = 'Student' where id = $1`, [student]);
    expect((await db.admin('select display_name from profiles where id = $1', [student]))[0].display_name).toBe('Student');
    await db.as(mentor, `insert into profiles_private (user_id, data) values ($1, '{"emergency_contact":"555-0100"}')`, [student]);
    expect(await db.denied(other, `update profiles set display_name = 'Hacked' where id = $1 returning id`, [student])).toBe(true);
    expect(await db.denied(other, `insert into profiles_private (user_id, data) values ($1, '{}')`, [mentor])).toBe(true);
  });
});
