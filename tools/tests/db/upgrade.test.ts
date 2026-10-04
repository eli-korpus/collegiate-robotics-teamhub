import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadCatalog, type Catalog } from '@teamhub/generator';
import { createTestDb, TEAM_A, withModules } from './harness';

const ALL = Object.keys(JSON.parse(readFileSync('tools/examples/demo.config.json', 'utf8')).modules);

/**
 * Upgrade test (spec §16.3). By default the "previous release" is simulated by dropping each module's newest
 * migration. To test against a real tag: `git worktree add ../prev v1.0.0 && (cd ../prev && npm ci)` then
 * `TEAMHUB_PREV_ROOT=../prev npm test -- tools/tests/db/upgrade.test.ts`.
 */
async function previousCatalog(): Promise<Catalog> {
  if (process.env.TEAMHUB_PREV_ROOT) return loadCatalog(process.env.TEAMHUB_PREV_ROOT);
  const now = await loadCatalog();
  const trim = <T extends { migrations: unknown[]; version: number }>(x: T): T => (x.migrations.length > 1 ? { ...x, migrations: x.migrations.slice(0, -1), version: x.version - 1 } : x);
  return {
    ...now,
    modules: new Map([...now.modules].map(([id, m]) => [id, trim(m)])),
    integrations: new Map([...now.integrations].map(([id, i]) => [id, trim(i)])),
  };
}

describe('upgrade', () => {
  it('previous release + data then current release keeps the data and reaches current versions', async () => {
    const db = await createTestDb();
    const prev = await previousCatalog();
    // Install the previous release with the tabs it had (newer releases may add tabs), then upgrade to every tab.
    await db.applyConfig(withModules(ALL.filter((id) => prev.modules.has(id))), true, prev);
    const config = withModules(ALL);
    const mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    await db.as(mentor, `insert into task_items (team_id, title, created_by) values ($1, 'Survives the upgrade', $2)`, [TEAM_A, mentor]);
    await db.as(mentor, `insert into sct_entries (event_code, team_number, data, scout) values ('USTEST1', 12345, '{"auto": 12}', $1)`, [mentor]);

    const plan = await db.applyConfig(config);
    const now = await loadCatalog();
    const state = await db.dbState();
    for (const id of ALL) expect(state.versions[id]?.version, id).toBe(now.modules.get(id)!.version);
    expect(plan.summary).toBeDefined();
    expect((await db.as(mentor, 'select title from task_items'))[0].title).toBe('Survives the upgrade');
    expect((await db.as(mentor, 'select data from sct_entries'))[0].data).toEqual({ auto: 12 });
  }, 120_000);

  it('applying the current release twice is a no-op for data', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(ALL), true);
    const m = await db.user('M', { [TEAM_A]: 'mentor' });
    await db.as(m, `insert into inv_items (team_id, name, qty) values ($1, 'goBILDA 5203', 4)`, [TEAM_A]);
    await db.applyConfig(withModules(ALL));
    expect((await db.as(m, 'select qty from inv_items'))[0].qty).toBe(4);
  }, 120_000);
});
