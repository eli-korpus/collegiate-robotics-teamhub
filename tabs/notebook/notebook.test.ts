import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, TEAM_B, withModules, type TestDb } from '../../tools/tests/db/harness';

describe('notebook RLS', () => {
  let db: TestDb;
  let mentor: string, member: string, member2: string, memberB: string;
  let entry: string;
  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(withModules(['notebook']), true);
    mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    member = await db.user('Member', { [TEAM_A]: 'member' });
    member2 = await db.user('Member 2', { [TEAM_A]: 'member' });
    memberB = await db.user('Member B', { [TEAM_B]: 'member' });
  });
  it('members write; co-authors can edit; others cannot', async () => {
    [{ id: entry }] = await db.as(member, `insert into nb_entries (team_id, title, authors, created_by) values ($1, 'Intake v2', array[$2, $3]::uuid[], $2) returning id`, [TEAM_A, member, member2]);
    expect((await db.as(member2, `update nb_entries set body = 'more' where id = $1 returning id`, [entry])).length).toBe(1);
    const other = await db.user('Other', { [TEAM_A]: 'member' });
    expect(await db.denied(other, `update nb_entries set body = 'x' where id = $1 returning id`, [entry])).toBe(true);
    expect(await db.as(memberB, `select * from nb_entries`)).toEqual([]);
  });
  it('subsystems are managed by captains/mentors only', async () => {
    expect(await db.denied(member, `insert into nb_subsystems (name) values ('Lift')`)).toBe(true);
    await db.as(mentor, `insert into nb_subsystems (name) values ('Lift')`);
  });
  it('images follow the entry and are queued for cleanup when deleted', async () => {
    await db.as(member, `insert into nb_images (entry_id, path) values ($1, 'a/b/c.webp')`, [entry]);
    await db.as(mentor, `delete from nb_entries where id = $1`, [entry]);
    expect((await db.admin('select path from teamhub_storage_trash')).map((r) => r.path)).toContain('a/b/c.webp');
  });
});
