import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules } from '../../tests/db/harness';

describe('scouting', () => {
  it('scouting lead builds versioned forms; members scout; pick list per team', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['scouting'], { positions: [{ id: 'pos_scouting_lead', name: 'Scouting Lead', grantsPermissions: true }] }), true);
    const lead = await db.user('Lead', { [TEAM_A]: 'member' }, { positions: ['pos_scouting_lead'] });
    const member = await db.user('Member', { [TEAM_A]: 'member' });
    expect(await db.denied(member, `insert into sct_templates (kind, fields) values ('match', '[]')`)).toBe(true);
    const [{ id }] = await db.as(lead, `insert into sct_templates (kind, fields) values ('match', '[{"id":"f1","label":"Cycles","type":"counter"}]') returning id`);
    await db.as(lead, `update sct_templates set fields = '[]' where id = $1`, [id]);
    expect((await db.admin('select version from sct_templates'))[0].version).toBe(2);
    await db.as(member, `insert into sct_entries (template_id, event_code, team_number, scout) values ($1, 'EV1', 1234, $2)`, [id, member]);
    expect(await db.denied(member, `insert into sct_picklist (event_code, team_id) values ('EV1', $1)`, [TEAM_A])).toBe(true);
    await db.as(lead, `insert into sct_picklist (event_code, team_id, ranking) values ('EV1', $1, '[{"team":1234}]')`, [TEAM_A]);
    expect(await db.as(null, 'select * from sct_entries')).toEqual([]);
  });
});

describe('past events are kept; only admins delete them', () => {
  it('summarizes past events and lets only admins delete one', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['scouting']), true);
    const admin = await db.user('Admin', { [TEAM_A]: 'mentor' }, { admin: true });
    const captain = await db.user('Captain', { [TEAM_A]: 'captain' });
    for (const code of ['OLD1', 'OLD1', 'NEW2']) await db.as(captain, `insert into sct_entries (event_code, team_number, scout) values ($1, 1234, $2)`, [code, captain]);
    await db.as(captain, `insert into sct_events (code, name, teams) values ('OLD1', 'Scrimmage', '{1234}')`);
    const sum = await db.as(captain, 'select event_code, entries, name from sct_event_summary() order by event_code');
    expect(sum).toEqual([{ event_code: 'NEW2', entries: 1, name: null }, { event_code: 'OLD1', entries: 2, name: 'Scrimmage' }]);
    expect(await db.denied(captain, `select sct_delete_event('OLD1', '2026–27')`)).toBe(true);
    expect(await db.denied(captain, `delete from sct_events returning code`)).toBe(true);
    expect((await db.as(admin, `select sct_delete_event('OLD1', '2026–27') n`))[0].n).toBe(2);
    expect((await db.admin('select count(*)::int n from sct_entries'))[0].n).toBe(1);
    expect(await db.admin('select * from sct_events')).toEqual([]);
  });
});
