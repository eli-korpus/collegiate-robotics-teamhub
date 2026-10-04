import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, TEAM_B, withModules } from '../../tools/tests/db/harness';

describe('signups', () => {
  it('enforces capacity, own claims and team scope', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['signups']), true);
    const cap = await db.user('Cap', { [TEAM_A]: 'captain' });
    const a = await db.user('A', { [TEAM_A]: 'member' });
    const b = await db.user('B', { [TEAM_A]: 'member' });
    const other = await db.user('Other', { [TEAM_B]: 'member' });
    expect(await db.denied(a, `insert into sign_sheets (team_id, title, created_by) values ($1, 'Snacks', $2)`, [TEAM_A, a])).toBe(true);
    const [{ id: sheet }] = await db.as(cap, `insert into sign_sheets (team_id, title, created_by) values ($1, 'Snacks', $2) returning id`, [TEAM_A, cap]);
    const [{ id: slot }] = await db.as(cap, `insert into sign_slots (sheet_id, label, capacity) values ($1, 'Saturday', 1) returning id`, [sheet]);
    expect(await db.denied(a, `insert into sign_claims (slot_id, user_id) values ($1, $2)`, [slot, b])).toBe(true);
    await db.as(a, `insert into sign_claims (slot_id, user_id) values ($1, $2)`, [slot, a]);
    await expect(db.as(b, `insert into sign_claims (slot_id, user_id) values ($1, $2)`, [slot, b])).rejects.toThrow(/full/);
    expect((await db.as(b, 'select user_id from sign_claims')).length).toBe(1);
    expect((await db.as(other, 'select * from sign_sheets')).length).toBe(0);
    expect(await db.denied(b, 'delete from sign_claims where slot_id = $1 returning *', [slot])).toBe(true);
    expect((await db.as(cap, 'delete from sign_claims where slot_id = $1 returning *', [slot])).length).toBe(1);
  });
});
