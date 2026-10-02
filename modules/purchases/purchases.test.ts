import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules, type TestDb } from '../../tests/db/harness';

describe('purchase requests', () => {
  let db: TestDb;
  let mentor: string, captain: string, member: string;
  let id: string;
  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(withModules(['purchases']), true);
    mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    captain = await db.user('Captain', { [TEAM_A]: 'captain' });
    member = await db.user('Member', { [TEAM_A]: 'member' });
  });
  it('requests notify orderers; requesters cannot order', async () => {
    [{ id }] = await db.as(member, `insert into pur_requests (team_id, item, requested_by) values ($1, 'Servos', $2) returning id`, [TEAM_A, member]);
    expect((await db.as(mentor, `select type from notifications`)).map((n) => n.type)).toEqual(['purchases.new']);
    expect(await db.as(captain, `select * from notifications`)).toEqual([]);
    expect(await db.denied(member, `update pur_requests set status = 'ordered' where id = $1 returning id`, [id])).toBe(true);
    expect(await db.denied(captain, `update pur_requests set status = 'ordered' where id = $1 returning id`, [id])).toBe(true);
  });
  it('mentor orders → timestamps + requester notified; requester can no longer edit', async () => {
    await db.as(mentor, `update pur_requests set status = 'ordered' where id = $1`, [id]);
    const [r] = await db.admin(`select ordered_at, handled_by from pur_requests where id = $1`, [id]);
    expect(r.ordered_at).toBeTruthy();
    expect(r.handled_by).toBe(mentor);
    expect((await db.as(member, `select type from notifications`)).map((n) => n.type)).toEqual(['purchases.status']);
    expect(await db.denied(member, `update pur_requests set item = 'x' where id = $1 returning id`, [id])).toBe(true);
  });
});
