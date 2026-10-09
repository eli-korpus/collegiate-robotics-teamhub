import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, TEAM_B, withModules, type TestDb } from './harness';

const ALL = Object.keys(JSON.parse(readFileSync('tools/examples/demo.config.json', 'utf8')).modules);

/** Fixes from the 1.0.9 security check. */
describe('security check (1.0.9)', () => {
  let db: TestDb;
  let admin: string, mentorA: string, captainA: string, memberA: string, captainAB: string;
  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(withModules(ALL), true);
    admin = await db.user('Admin', { [TEAM_A]: 'mentor' }, { admin: true });
    mentorA = await db.user('MentorA', { [TEAM_A]: 'mentor' });
    captainA = await db.user('CaptainA', { [TEAM_A]: 'captain' });
    memberA = await db.user('MemberA', { [TEAM_A]: 'member' });
    // Captain on team A, only a member on team B.
    captainAB = await db.user('CaptainAB', { [TEAM_A]: 'captain', [TEAM_B]: 'member' });
  }, 180_000);

  const authorOf = async (table: string, col: string, id: string) => (await db.admin(`select ${col} v from ${table} where id = $1`, [id]))[0].v;

  it('nobody can change who wrote something, in any tab', async () => {
    const [post] = await db.as(captainA, `insert into ann_posts (team_id, title, body, created_by) values ($1, 'Hi', 'x', $2) returning id`, [TEAM_A, captainA]);
    await db.as(captainA, `update ann_posts set created_by = $2, title = 'Edited' where id = $1`, [post.id, mentorA]);
    expect(await authorOf('ann_posts', 'created_by', post.id)).toBe(captainA);
    expect((await db.admin('select title from ann_posts where id = $1', [post.id]))[0].title).toBe('Edited');

    const [req] = await db.as(memberA, `insert into pur_requests (team_id, item, requested_by) values ($1, 'Motor', $2) returning id`, [TEAM_A, memberA]);
    await db.as(memberA, `update pur_requests set requested_by = $2 where id = $1`, [req.id, mentorA]);
    expect(await authorOf('pur_requests', 'requested_by', req.id)).toBe(memberA);

    const [entry] = await db.as(memberA, `insert into nb_entries (team_id, title, created_by) values ($1, 'Day 1', $2) returning id`, [TEAM_A, memberA]);
    await db.as(memberA, `update nb_entries set created_by = $2 where id = $1`, [entry.id, captainA]);
    expect(await authorOf('nb_entries', 'created_by', entry.id)).toBe(memberA);

    // Every table with an author column has the guard.
    const missing = await db.admin(`
      select distinct c.table_name from information_schema.columns c join information_schema.tables t using (table_schema, table_name)
      where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
        and c.column_name in ('created_by', 'requested_by', 'reported_by', 'uploaded_by', 'started_by', 'author', 'scout')
        and not exists (select 1 from pg_trigger g where g.tgrelid = ('public.' || c.table_name)::regclass and g.tgname = 'teamhub_keep_author')`);
    expect(missing).toEqual([]);
  });

  it('the database itself can still change authors (an account being deleted)', async () => {
    const [post] = await db.as(captainA, `insert into ann_posts (team_id, title, body, created_by) values ($1, 'Mine', 'x', $2) returning id`, [TEAM_A, captainA]);
    await db.admin(`update ann_posts set created_by = null where id = $1`, [post.id]);
    expect(await authorOf('ann_posts', 'created_by', post.id)).toBeNull();
  });

  it("only admins can edit an admin's profile", async () => {
    expect(await db.denied(mentorA, `update profiles set display_name = 'Renamed' where id = $1 returning id`, [admin])).toBe(true);
    expect(await db.as(mentorA, `update profiles set display_name = 'Member Renamed' where id = $1 returning id`, [memberA])).toHaveLength(1);
    expect(await db.as(admin, `update profiles set display_name = 'Mentor A' where id = $1 returning id`, [mentorA])).toHaveLength(1);
  });

  it("a badge can't be moved to a team you don't manage", async () => {
    await db.as(mentorA, `insert into positions (id, name, team_id, source, grants_permissions) values ('pos_safety', 'Safety', $1, 'app', false)`, [TEAM_A]);
    await db.as(mentorA, `update positions set team_id = $1 where id = 'pos_safety'`, [TEAM_B]).catch(() => undefined);
    expect((await db.admin(`select team_id from positions where id = 'pos_safety'`))[0].team_id).toBe(TEAM_A);
  });

  it("links and requests can't be moved to a team where you can't post them", async () => {
    const [link] = await db.as(captainAB, `insert into links (label, url, team_id, created_by) values ('Guide', 'https://example.org', $1, $2) returning id`, [TEAM_A, captainAB]);
    await db.as(captainAB, `update links set team_id = $2 where id = $1`, [link.id, TEAM_B]).catch(() => undefined);
    expect((await db.admin('select team_id from links where id = $1', [link.id]))[0].team_id).toBe(TEAM_A);
    // Albums need a captain or mentor: CaptainAB is only a member on team B.
    const [album] = await db.as(captainAB, `insert into med_albums (team_id, title, created_by) values ($1, 'Kickoff', $2) returning id`, [TEAM_A, captainAB]);
    await db.as(captainAB, `update med_albums set team_id = $2 where id = $1`, [album.id, TEAM_B]).catch(() => undefined);
    expect((await db.admin('select team_id from med_albums where id = $1', [album.id]))[0].team_id).toBe(TEAM_A);
  });

  it('asking for account deletion notifies mentors once a day, not every click', async () => {
    await db.as(memberA, 'select people_request_deletion()');
    await db.as(memberA, 'select people_request_deletion()');
    const n = await db.admin(`select count(*)::int n from notifications where type = 'people.deletion_request' and ref = $1`, [`core:person:${memberA}`]);
    expect(n[0].n).toBe((await db.admin(`select count(distinct user_id)::int n from notifications where type = 'people.deletion_request'`))[0].n);
  });

  it('attendance codes are 4 digits and last at most 5 minutes', async () => {
    const [s] = await db.as(captainA, `insert into att_sessions (team_id, title, date, created_by) values ($1, 'Practice', current_date, $2) returning id`, [TEAM_A, captainA]);
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const [{ r }] = await db.as(captainA, `select att_rotate_code($1, 99999) r`, [s.id]);
      expect(r.code).toMatch(/^\d{4}$/);
      expect(new Date(r.expires_at).getTime() - Date.now()).toBeLessThan(316_000);
      codes.add(r.code);
    }
    expect(codes.size).toBeGreaterThan(10);
  });

  it('the old Request info status check is closed', async () => {
    await expect(db.as(mentorA, `select * from info_request_status('00000000-0000-4000-8000-000000000000')`)).rejects.toThrow();
  });
});
