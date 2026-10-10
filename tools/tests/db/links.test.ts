import { beforeAll, describe, expect, it } from 'vitest';
import { catalogBefore, createTestDb, TEAM_A, TEAM_B, testConfig, type TestDb } from './harness';

/** Tool links can be one for the whole program or one per team. */
describe('team-specific tool links', () => {
  let db: TestDb;
  let memberA: string, memberB: string;
  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(
      testConfig({
        toolLinks: [
          { slot: 'team_chat', label: 'Chat', url: 'https://chat.example.org' },
          { slot: 'code_repo', teamId: TEAM_A, label: 'Code', url: 'https://example.org/a' },
          { slot: 'code_repo', teamId: TEAM_B, label: 'Code', url: 'https://example.org/b' },
        ],
      }),
      true,
    );
    memberA = await db.user('MemberA', { [TEAM_A]: 'member' });
    memberB = await db.user('MemberB', { [TEAM_B]: 'member' });
  }, 120_000);

  it('setup saves each link with its team', async () => {
    expect(await db.admin('select slot, team_id from links order by sort')).toEqual([
      { slot: 'team_chat', team_id: null },
      { slot: 'code_repo', team_id: TEAM_A },
      { slot: 'code_repo', team_id: TEAM_B },
    ]);
  });

  it("people see the program's links and their own team's, never another team's", async () => {
    expect((await db.as(memberA, 'select url from links order by url')).map((r) => r.url)).toEqual(['https://chat.example.org', 'https://example.org/a']);
    expect((await db.as(memberB, 'select url from links order by url')).map((r) => r.url)).toEqual(['https://chat.example.org', 'https://example.org/b']);
  });

  it('a one-team program ignores team ids in links', async () => {
    const solo = await createTestDb();
    await solo.applyConfig(
      testConfig({
        program: { name: 'Solo', multiTeam: false },
        teams: [{ id: TEAM_A, number: 12345, name: 'Alpha', shortCode: 'A', color: '#3B82F6' }],
        toolLinks: [{ slot: 'code_repo', teamId: TEAM_A, label: 'Code', url: 'https://example.org/a' }],
      }),
      true,
    );
    expect(await solo.admin('select team_id from links')).toEqual([{ team_id: null }]);
  }, 120_000);
});

/** 007: "Not pinned" tool links (no kind) showed up nowhere, so updating removes them, but never Bulletin Board links. */
describe('removing unpinned tool links on update', () => {
  const beforeCleanup = () => catalogBefore('007_');
  const unpinned = `insert into links (label, url, slot) values ('Pinned', 'https://example.org/p', 'cad'), ('Loose', 'https://example.org/l', null)`;

  it('removes links without a kind when Bulletin Board was never installed', async () => {
    const db = await createTestDb();
    await db.applyConfig(testConfig(), true, await beforeCleanup());
    await db.admin(unpinned);
    await db.applyConfig(testConfig());
    expect(await db.admin('select label from links order by label')).toEqual([{ label: 'Pinned' }]);
  }, 120_000);

  it('keeps Bulletin Board links, and 009 retires the tab and its policies', async () => {
    const db = await createTestDb();
    await db.applyConfig(testConfig(), true, await beforeCleanup());
    // What an older database with Bulletin Board installed looks like (the tab no longer exists to install).
    await db.admin(`insert into teamhub_modules (id, version, state) values ('bulletin', 0, 'active')`);
    await db.admin(`create policy bul_links_insert on links for insert to authenticated with check (true)`);
    await db.admin(unpinned);
    await db.applyConfig(testConfig());
    expect(await db.admin('select label from links order by label')).toEqual([{ label: 'Loose' }, { label: 'Pinned' }]);
    expect(await db.admin(`select id from teamhub_modules where id = 'bulletin'`)).toEqual([]);
    expect(await db.admin(`select policyname from pg_policies where policyname like 'bul_%'`)).toEqual([]);
  }, 120_000);
});

/** The Links page: core.add_links adds links without a kind and edits its own; core.edit_links manages all. */
describe('links permissions', () => {
  let db: TestDb;
  let mentor: string, captain: string, member: string, captainB: string;
  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(testConfig(), true);
    mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    captain = await db.user('Captain', { [TEAM_A]: 'captain' });
    member = await db.user('Member', { [TEAM_A]: 'member' });
    captainB = await db.user('CaptainB', { [TEAM_B]: 'captain' });
  }, 120_000);

  it('captains add links, but not team tools; members only view', async () => {
    await db.as(captain, `insert into links (label, url, section, team_id, created_by) values ('CAD tips', 'https://a.dev', 'CAD', $1, $2)`, [TEAM_A, captain]);
    expect(await db.denied(captain, `insert into links (label, url, slot, team_id, created_by) values ('Chat', 'https://c.dev', 'team_chat', $1, $2)`, [TEAM_A, captain])).toBe(true);
    expect(await db.denied(captain, `insert into links (label, url, slot, team_id, created_by) values ('Other', 'https://o.dev', 'other', $1, $2)`, [TEAM_A, captain])).toBe(true);
    expect(await db.denied(member, `insert into links (label, url, team_id, created_by) values ('x', 'https://x.dev', $1, $2)`, [TEAM_A, member])).toBe(true);
    expect((await db.as(member, `select label from links where label = 'CAD tips'`)).length).toBe(1);
  });

  it('captains edit and remove only their own links, and cannot make them team tools', async () => {
    await db.as(mentor, `insert into links (label, url, slot, team_id, created_by) values ('Onshape', 'https://cad.dev', 'cad', $1, $2)`, [TEAM_A, mentor]);
    await db.as(mentor, `insert into links (label, url, team_id, created_by) values ('Mentor link', 'https://m.dev', $1, $2)`, [TEAM_A, mentor]);
    expect(await db.denied(captain, `update links set label = 'x' where label = 'Mentor link' returning id`)).toBe(true);
    expect(await db.denied(captain, `update links set url = 'https://evil.dev' where label = 'Onshape' returning id`)).toBe(true);
    expect(await db.denied(captain, `update links set slot = 'team_chat' where label = 'CAD tips' returning id`)).toBe(true);
    expect((await db.as(captain, `update links set label = 'CAD tricks' where label = 'CAD tips' returning id`)).length).toBe(1);
    expect(await db.denied(captainB, `delete from links where label = 'CAD tricks' returning id`)).toBe(true);
  });

  it('mentors manage every link, including team tools', async () => {
    expect((await db.as(mentor, `update links set section = 'Design' where label = 'CAD tricks' returning id`)).length).toBe(1);
    expect((await db.as(mentor, `update links set slot = 'other' where label = 'Mentor link' returning id`)).length).toBe(1);
    expect((await db.as(mentor, `delete from links where label = 'CAD tricks' returning id`)).length).toBe(1);
    expect((await db.as(captain, `delete from links where label = 'Mentor link' returning id`)).length).toBe(0);
  });
});
