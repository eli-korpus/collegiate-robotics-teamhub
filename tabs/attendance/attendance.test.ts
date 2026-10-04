import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, TEAM_B, withModules, type TestDb } from '../../tools/tests/db/harness';

describe('attendance RLS + check-in', () => {
  let db: TestDb;
  let mentorA: string, captainA: string, memberA: string, member2A: string, memberB: string;
  let session: string;

  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(withModules(['attendance']), true);
    await db.user('Admin', { [TEAM_A]: 'mentor' }, { admin: true });
    mentorA = await db.user('Mentor A', { [TEAM_A]: 'mentor' });
    captainA = await db.user('Captain A', { [TEAM_A]: 'captain' });
    memberA = await db.user('Member A', { [TEAM_A]: 'member' });
    member2A = await db.user('Member A2', { [TEAM_A]: 'member' });
    memberB = await db.user('Member B', { [TEAM_B]: 'member' });
    [{ id: session }] = await db.as(captainA, `insert into att_sessions (team_id, created_by) values ($1, $2) returning id`, [TEAM_A, captainA]);
  });

  it('only takers start sessions; season defaults from settings', async () => {
    expect(await db.denied(memberA, `insert into att_sessions (team_id, created_by) values ($1, $2)`, [TEAM_A, memberA])).toBe(true);
    const [s] = await db.admin('select season from att_sessions where id = $1', [session]);
    expect(s.season).toBe('2026–27');
  });

  it('members see only their own presence', async () => {
    await db.as(captainA, `insert into att_presence (session_id, user_id) values ($1, $2), ($1, $3)`, [session, memberA, member2A]);
    expect((await db.as(memberA, 'select user_id from att_presence')).map((r) => r.user_id)).toEqual([memberA]);
    expect((await db.as(captainA, 'select user_id from att_presence')).length).toBe(2);
    expect(await db.denied(memberA, `delete from att_presence where user_id = $1 returning user_id`, [member2A])).toBe(true);
  });

  it('self check-in needs the current code and team membership', async () => {
    expect(await db.denied(memberA, `select att_rotate_code($1)`, [session])).toBe(true);
    const [{ r }] = await db.as(captainA, `select att_rotate_code($1, 30) r`, [session]);
    const code = r.code as string;
    const wrong = code === '0000' ? '1111' : '0000';
    await db.as(captainA, `delete from att_presence where user_id = $1`, [memberA]);
    expect((await db.as(memberA, `select att_check_in($1, $2) r`, [session, wrong]))[0].r).toBe('wrong_code');
    expect(await db.as(memberA, 'select * from att_attempts')).toEqual([]); // not readable by clients
    expect(await db.denied(memberB, `select att_check_in($1, $2)`, [session, code])).toBe(true);
    await db.as(memberA, `select att_check_in($1, $2)`, [session, code]);
    const [p] = await db.admin('select check_in from att_presence where session_id = $1 and user_id = $2', [session, memberA]);
    expect(p.check_in).toBeTruthy();
    expect(await db.as(memberA, 'select * from att_codes')).toEqual([]);
  });

  it('locks self check-in after 5 wrong codes', async () => {
    const [{ r }] = await db.as(captainA, `select att_rotate_code($1, 30) r`, [session]);
    const wrong = r.code === '9999' ? '8888' : '9999';
    for (let i = 0; i < 5; i++) await db.as(member2A, `select att_check_in($1, $2)`, [session, wrong]);
    await expect(db.as(member2A, `select att_check_in($1, $2)`, [session, r.code])).rejects.toThrow(/Too many wrong codes/);
  });

  it('closing removes the code and blocks check-in; hours check-out', async () => {
    const [{ r }] = await db.as(captainA, `select att_rotate_code($1, 30) r`, [session]);
    await db.as(captainA, `select att_close($1, true)`, [session]);
    expect(await db.admin('select * from att_codes')).toEqual([]);
    expect(await db.denied(member2A, `select att_check_in($1, $2)`, [session, r.code])).toBe(true);
    const rows = await db.admin('select check_out from att_presence where session_id = $1 and check_in is not null', [session]);
    expect(rows.every((x) => x.check_out)).toBe(true);
  });

  it('past attendance is editable by mentors only', async () => {
    const [{ id: old }] = await db.admin(`insert into att_sessions (team_id, date) values ($1, current_date - 5) returning id`, [TEAM_A]);
    expect(await db.denied(captainA, `insert into att_presence (session_id, user_id) values ($1, $2) returning user_id`, [old, memberA])).toBe(true);
    const ok = await db.as(mentorA, `insert into att_presence (session_id, user_id) values ($1, $2) returning user_id`, [old, memberA]);
    expect(ok.length).toBe(1);
  });
});
