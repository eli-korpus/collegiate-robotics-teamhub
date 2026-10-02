import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, TEAM_B, withModules, type TestDb } from '../../tests/db/harness';

describe('events notes RLS', () => {
  let db: TestDb;
  it('captains write notes for their team only; other teams cannot read them', async () => {
    db = await createTestDb();
    await db.applyConfig(withModules(['events']), true);
    const captain = await db.user('Captain', { [TEAM_A]: 'captain' });
    const member = await db.user('Member', { [TEAM_A]: 'member' });
    const memberB = await db.user('Member B', { [TEAM_B]: 'member' });
    await db.as(captain, `insert into evt_notes (team_id, season, event_code, notes) values ($1, 2026, 'USNYQ1', 'Bring spare servos')`, [TEAM_A]);
    expect(await db.denied(captain, `insert into evt_notes (team_id, season, event_code) values ($1, 2026, 'X')`, [TEAM_B])).toBe(true);
    expect(await db.denied(member, `update evt_notes set notes = 'x' returning team_id`)).toBe(true);
    expect((await db.as(member, 'select notes from evt_notes')).length).toBe(1);
    expect(await db.as(memberB, 'select * from evt_notes')).toEqual([]);
  });
});
