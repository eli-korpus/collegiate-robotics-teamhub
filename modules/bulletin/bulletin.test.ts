import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules, type TestDb } from '../../tests/db/harness';

describe('bulletin board RLS', () => {
  let db: TestDb;
  let mentor: string, captain: string, member: string;
  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(withModules(['bulletin']), true);
    mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    captain = await db.user('Captain', { [TEAM_A]: 'captain' });
    member = await db.user('Member', { [TEAM_A]: 'member' });
  });
  it('captains can post links but not pinned tool links', async () => {
    await db.as(captain, `insert into links (label, url, section, created_by) values ('CAD tips', 'https://a.dev', 'CAD', $1)`, [captain]);
    expect(await db.denied(captain, `insert into links (label, url, slot, created_by) values ('Chat', 'https://c.dev', 'team_chat', $1)`, [captain])).toBe(true);
    expect(await db.denied(member, `insert into links (label, url, created_by) values ('x', 'https://x.dev', $1)`, [member])).toBe(true);
  });
  it("captains edit only their own; mentors manage all", async () => {
    await db.as(mentor, `insert into links (label, url, created_by) values ('Mentor link', 'https://m.dev', $1)`, [mentor]);
    expect(await db.denied(captain, `update links set label = 'x' where label = 'Mentor link' returning id`)).toBe(true);
    expect((await db.as(mentor, `update links set label = 'CAD tricks' where label = 'CAD tips' returning id`)).length).toBe(1);
  });
  it('without the tab, only core.edit_links can add links', async () => {
    await db.applyConfig(withModules([]));
    expect(await db.denied(captain, `insert into links (label, url, created_by) values ('y', 'https://y.dev', $1)`, [captain])).toBe(true);
    expect((await db.as(member, 'select label from links order by label')).map((r) => r.label)).toEqual(['CAD tricks', 'Mentor link']);
  });
});
