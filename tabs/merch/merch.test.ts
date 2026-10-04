import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules } from '../../tools/tests/db/harness';

describe('merch', () => {
  it('members see only their own order and cannot mark it paid', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['merch']), true);
    const mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    const a = await db.user('A', { [TEAM_A]: 'member' });
    const b = await db.user('B', { [TEAM_A]: 'member' });
    const [{ id }] = await db.as(mentor, `insert into mer_drives (team_id, title, items, created_by) values ($1, 'Shirts', '[{"id":"tee","name":"Tee","sizes":["S","M"]}]', $2) returning id`, [TEAM_A, mentor]);
    await db.as(a, `insert into mer_orders (drive_id, user_id, lines, paid) values ($1, $2, '[{"item":"tee","size":"M","qty":1}]', true)`, [id, a]);
    await db.as(b, `insert into mer_orders (drive_id, user_id, lines) values ($1, $2, '[{"item":"tee","size":"S","qty":2}]')`, [id, b]);
    expect((await db.as(a, 'select paid from mer_orders'))).toEqual([{ paid: false }]);
    expect(await db.denied(a, `update mer_orders set user_id = $1 where user_id = $2 returning *`, [b, a])).toBe(true);
    expect((await db.as(mentor, 'select * from mer_orders')).length).toBe(2);
    await db.as(mentor, `update mer_orders set paid = true where user_id = $1`, [a]);
    await db.as(mentor, `update mer_drives set status = 'closed' where id = $1`, [id]);
    await expect(db.as(a, `update mer_orders set lines = '[]' where user_id = $1`, [a])).rejects.toThrow(/closed/);
    expect(await db.denied(a, `delete from mer_orders where user_id = $1 returning *`, [a])).toBe(true);
  });
});
