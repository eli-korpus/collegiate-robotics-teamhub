import { beforeAll, describe, expect, it } from 'vitest';
import { loadCatalog } from '@teamhub/generator';
import { createTestDb, TEAM_A, TEAM_B, testConfig, withModules, type TestDb } from './harness';

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
  const beforeCleanup = async () => {
    const now = await loadCatalog();
    const core = { ...now.core, migrations: now.core.migrations.filter((m) => !m.name.startsWith('007_')), version: now.core.version - 1 };
    return { ...now, core };
  };
  const unpinned = `insert into links (label, url, slot) values ('Pinned', 'https://example.org/p', 'cad'), ('Loose', 'https://example.org/l', null)`;

  it('removes links without a kind when Bulletin Board was never installed', async () => {
    const db = await createTestDb();
    await db.applyConfig(testConfig(), true, await beforeCleanup());
    await db.admin(unpinned);
    await db.applyConfig(testConfig());
    expect(await db.admin('select label from links order by label')).toEqual([{ label: 'Pinned' }]);
  }, 120_000);

  it('keeps them when they are Bulletin Board links', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['bulletin']), true, await beforeCleanup());
    await db.admin(unpinned);
    await db.applyConfig(withModules(['bulletin']));
    expect(await db.admin('select label from links order by label')).toEqual([{ label: 'Loose' }, { label: 'Pinned' }]);
  }, 120_000);
});
