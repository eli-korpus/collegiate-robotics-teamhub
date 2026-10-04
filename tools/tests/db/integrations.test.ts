import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules } from './harness';

describe('repairs+inventory integration', () => {
  it('using a part records it and decrements stock; removing inventory tears the link down', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['repairs', 'inventory']), true);
    const member = await db.user('Member', { [TEAM_A]: 'member' });
    const mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    const [{ id: part }] = await db.as(mentor, `insert into inv_items (name, qty) values ('GT2 belt', 4) returning id`);
    const [{ id: issue }] = await db.as(member, `insert into rep_issues (title, reported_by) values ('Belt snapped', $1) returning id`, [member]);
    await db.as(member, `select ix_repinv_use($1, $2, 1)`, [issue, part]);
    expect((await db.admin('select qty from inv_items'))[0].qty).toBe(3);
    expect((await db.as(member, 'select qty from ix_repinv_parts'))[0].qty).toBe(1);
    await db.applyConfig(withModules(['repairs']));
    expect((await db.admin(`select to_regclass('public.ix_repinv_parts') t`))[0].t).toBeNull();
    expect((await db.as(member, 'select title from rep_issues')).length).toBe(1);
  });
});
