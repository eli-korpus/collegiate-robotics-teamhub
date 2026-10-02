import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules } from '../../tests/db/harness';

describe('competition day', () => {
  it('members edit pit notes only; switching events archives the old one; only admins delete history', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['competition-day']), true);
    const admin = await db.user('Admin', { [TEAM_A]: 'mentor' }, { admin: true });
    const captain = await db.user('Captain', { [TEAM_A]: 'captain' });
    const member = await db.user('Member', { [TEAM_A]: 'member' });
    expect(await db.denied(member, `insert into comp_active (team_id, event_code, season) values ($1, 'EV1', 2026)`, [TEAM_A])).toBe(true);
    await db.as(captain, `insert into comp_active (team_id, event_code, season) values ($1, 'EV1', 2026)`, [TEAM_A]);
    await db.as(member, `select comp_set_notes($1, 'Spare servo in box 3')`, [TEAM_A]);
    expect(await db.denied(member, `update comp_active set event_code = 'X' returning team_id`)).toBe(true);
    await db.as(captain, `update comp_active set event_code = 'EV2' where team_id = $1`, [TEAM_A]);
    const [cur] = await db.admin('select event_code, pit_notes from comp_active');
    expect(cur).toEqual({ event_code: 'EV2', pit_notes: '' });
    const hist = await db.as(member, 'select event_code, pit_notes from comp_history');
    expect(hist).toEqual([{ event_code: 'EV1', pit_notes: 'Spare servo in box 3' }]);
    expect(await db.denied(captain, 'delete from comp_history returning id')).toBe(true);
    expect((await db.as(admin, 'delete from comp_history returning id')).length).toBe(1);
  });
});
