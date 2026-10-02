import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules } from '../../tests/db/harness';

describe('sponsors', () => {
  it('is hidden from members', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['sponsors']), true);
    const cap = await db.user('Cap', { [TEAM_A]: 'captain' });
    const a = await db.user('A', { [TEAM_A]: 'member' });
    await db.as(cap, `insert into spn_sponsors (team_id, name, contact_email, status) values ($1, 'Acme', 'jo@acme.test', 'asked')`, [TEAM_A]);
    expect((await db.as(a, 'select * from spn_sponsors')).length).toBe(0);
    expect((await db.as(cap, 'select * from spn_sponsors')).length).toBe(1);
    expect(await db.denied(a, `insert into spn_sponsors (team_id, name) values ($1, 'X')`, [TEAM_A])).toBe(true);
  });
});
