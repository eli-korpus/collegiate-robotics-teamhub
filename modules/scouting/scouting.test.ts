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
