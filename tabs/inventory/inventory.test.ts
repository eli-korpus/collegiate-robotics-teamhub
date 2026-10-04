import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules } from '../../tools/tests/db/harness';

describe('inventory', () => {
  it('managers add parts; members only adjust quantities, never below zero', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['inventory'], { positions: [{ id: 'pos_inventory_manager', name: 'Inventory Manager', grantsPermissions: true }] }), true);
    const manager = await db.user('Manager', { [TEAM_A]: 'member' }, { positions: ['pos_inventory_manager'] });
    const member = await db.user('Member', { [TEAM_A]: 'member' });
    const [{ id }] = await db.as(manager, `insert into inv_items (name, qty) values ('M3 screws', 2) returning id`);
    expect(await db.denied(member, `update inv_items set name = 'x' where id = $1 returning id`, [id])).toBe(true);
    expect((await db.as(member, `select inv_adjust($1, -5) q`, [id]))[0].q).toBe(0);
    expect((await db.as(member, `select inv_adjust($1, 3) q`, [id]))[0].q).toBe(3);
  });
});
