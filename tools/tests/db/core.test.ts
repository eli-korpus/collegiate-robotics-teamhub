import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, TEAM_B, testConfig, type TestDb } from './harness';

describe('core schema + RLS', () => {
  let db: TestDb;
  let admin: string, mentorA: string, captainA: string, memberA: string, memberB: string;

  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(testConfig(), true);
    admin = await db.user('Ada Admin', { [TEAM_A]: 'mentor' }, { admin: true });
    mentorA = await db.user('Mona Mentor', { [TEAM_A]: 'mentor' });
    captainA = await db.user('Cal Captain', { [TEAM_A]: 'captain' });
    memberA = await db.user('Max Member', { [TEAM_A]: 'member' });
    memberB = await db.user('Bea Member', { [TEAM_B]: 'member' });
  });

  it('records versions and seeds config rows', async () => {
    const mods = await db.admin('select id, version from teamhub_modules');
    expect(mods).toEqual([{ id: 'core', version: 9 }]);
    expect((await db.admin('select count(*)::int n from teams'))[0].n).toBe(2);
    expect((await db.admin(`select season_label from teamhub_settings`))[0].season_label).toBe('2026–27');
  });

  it('signup creates a pending profile and membership; pending users see only themselves', async () => {
    const id = await db.signUp('new@x.dev', { name: 'Newbie', teams: [TEAM_A], requested_type: 'member', note: 'hi' });
    const [p] = await db.admin('select status, display_name from profiles where id = $1', [id]);
    expect(p).toEqual({ status: 'pending', display_name: 'Newbie' });
    const seen = await db.as(id, 'select id from profiles');
    expect(seen.map((r) => r.id)).toEqual([id]);
    expect(await db.as(id, 'select * from links')).toEqual([]);
  });

  it('approvers are notified and tiered approval works', async () => {
    const pendingMember = await db.signUp('m@x.dev', { name: 'Pending Member', teams: [TEAM_A], requested_type: 'member' });
    const pendingMentor = await db.signUp('me@x.dev', { name: 'Pending Mentor', teams: [TEAM_A], requested_type: 'mentor' });
    const notes = await db.as(captainA, `select ref from notifications where type = 'people.request'`);
    expect(notes.map((n) => n.ref)).toContain(`core:person:${pendingMember}`);
    expect(notes.map((n) => n.ref)).not.toContain(`core:person:${pendingMentor}`);

    // Captain can see + approve the member request, but not the mentor one.
    expect((await db.as(captainA, 'select id from profiles where id = $1', [pendingMember])).length).toBe(1);
    expect((await db.as(captainA, 'select id from profiles where id = $1', [pendingMentor])).length).toBe(0);
    await db.as(captainA, `select people_approve($1, $2, 'member')`, [pendingMember, TEAM_A]);
    expect(await db.denied(captainA, `select people_approve($1, $2, 'mentor')`, [pendingMentor, TEAM_A])).toBe(true);
    // Captain cannot sneak a mentor request through as a member either.
    expect(await db.denied(captainA, `select people_approve($1, $2, 'member')`, [pendingMentor, TEAM_A])).toBe(true);
    await db.as(mentorA, `select people_approve($1, $2, 'mentor')`, [pendingMentor, TEAM_A]);
    const rows = await db.admin(`select status from profiles where id in ($1, $2)`, [pendingMember, pendingMentor]);
    expect(rows.every((r) => r.status === 'active')).toBe(true);
  });

  it('members cannot escalate themselves', async () => {
    expect(await db.denied(memberA, `update profiles set is_admin = true where id = $1`, [memberA])).toBe(true);
    expect(await db.denied(memberA, `update memberships set type = 'mentor' where user_id = $1`, [memberA])).toBe(true);
    expect(await db.denied(memberA, `select people_set_admin($1, true)`, [memberA])).toBe(true);
    const [p] = await db.admin('select is_admin from profiles where id = $1', [memberA]);
    expect(p.is_admin).toBe(false);
    // Own name is editable
    await db.as(memberA, `update profiles set display_name = 'Maxine' where id = $1`, [memberA]);
    expect((await db.admin('select display_name from profiles where id = $1', [memberA]))[0].display_name).toBe('Maxine');
  });

  it('keeps at least one admin', async () => {
    expect(await db.denied(admin, `select people_set_admin($1, false)`, [admin])).toBe(true);
    await db.as(admin, `select people_set_admin($1, true)`, [mentorA]);
    await db.as(admin, `select people_set_admin($1, false)`, [admin]);
    await db.as(mentorA, `select people_set_admin($1, true)`, [admin]);
  });

  it('private fields are visible to self and mentors only', async () => {
    await db.as(memberA, `insert into profiles_private (user_id, data) values ($1, '{"emergency_contact":"555"}')`, [memberA]);
    expect((await db.as(memberA, 'select data from profiles_private')).length).toBe(1);
    expect((await db.as(mentorA, 'select data from profiles_private where user_id = $1', [memberA])).length).toBe(1);
    expect((await db.as(captainA, 'select data from profiles_private where user_id = $1', [memberA])).length).toBe(0);
    expect((await db.as(memberB, 'select data from profiles_private where user_id = $1', [memberA])).length).toBe(0);
  });

  it('team-scoped links are isolated between teams', async () => {
    await db.as(mentorA, `insert into links (label, url, team_id, created_by) values ('A only', 'https://a.dev', $1, $2)`, [TEAM_A, mentorA]);
    await db.as(admin, `insert into links (label, url, created_by) values ('Everyone', 'https://all.dev', $1)`, [admin]);
    expect((await db.as(memberB, 'select label from links order by label')).map((r) => r.label)).toEqual(['Everyone']);
    expect((await db.as(memberA, 'select label from links order by label')).map((r) => r.label)).toEqual(['A only', 'Everyone']);
    expect(await db.denied(memberA, `insert into links (label, url, created_by) values ('x', 'https://x.dev', $1)`, [memberA])).toBe(true);
  });

  it('notifications are private and anon sees nothing', async () => {
    expect(await db.denied(null, 'select * from profiles')).toBe(true);
    expect(await db.denied(null, 'select * from notifications')).toBe(true);
    const theirs = await db.as(memberB, 'select * from notifications where user_id <> $1', [memberB]);
    expect(theirs).toEqual([]);
  });

  it('deleting an auth user anonymizes active people and removes pending ones', async () => {
    const pending = await db.signUp('gone@x.dev', { name: 'Gone', teams: [TEAM_A] });
    await db.admin('delete from auth.users where id = $1', [pending]);
    expect(await db.admin('select * from profiles where id = $1', [pending])).toEqual([]);
    await db.admin('delete from auth.users where id = $1', [memberB]);
    const [p] = await db.admin('select display_name, status from profiles where id = $1', [memberB]);
    expect(p).toEqual({ display_name: 'Former member', status: 'inactive' });
  });

  it('storage usage is admin-only', async () => {
    const [u] = await db.as(admin, 'select teamhub_storage_usage() u');
    expect(u.u.db_bytes).toBeGreaterThan(0);
    expect(await db.denied(memberA, 'select teamhub_storage_usage()')).toBe(true);
  });

  it('keep-alive ping works anonymously', async () => {
    const [r] = await db.as(null, 'select teamhub_ping() t');
    expect(r.t).toBeTruthy();
  });

  it('re-applying the same config is idempotent', async () => {
    await db.applyConfig(testConfig());
    await db.applyConfig(testConfig());
    expect((await db.admin('select count(*)::int n from teams'))[0].n).toBe(2);
  });
});
