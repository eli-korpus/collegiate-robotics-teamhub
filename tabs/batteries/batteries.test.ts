import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules, type TestDb } from '../../tools/tests/db/harness';
import { batteryStatus } from './ui/data';

const S = { chargedVolts: 13, weakVolts: 12.5, staleHours: 48 };
const b = { id: 'b', team_id: null, label: 'B1', type: null, purchased: null, retired: false, notes: null };
const log = (kind: string, hoursAgo: number, voltage: number | null = null) => ({ id: Math.random(), battery_id: 'b', kind, voltage, note: null, at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(), by: null }) as never;

describe('battery status', () => {
  it('charged then used then needs charge; stale charge; weak test', () => {
    expect(batteryStatus(b, [log('charged', 1)], S).state).toBe('charged');
    expect(batteryStatus(b, [log('used', 0.5), log('charged', 1)], S).state).toBe('needs_charge');
    expect(batteryStatus(b, [log('charged', 72)], S).state).toBe('needs_charge');
    expect(batteryStatus(b, [log('tested', 0.5, 12.2), log('charged', 1)], S).state).toBe('weak');
  });
});

describe('battery RLS + pruning', () => {
  let db: TestDb;
  it('members log, captains manage, logs are pruned to 200', async () => {
    db = await createTestDb();
    await db.applyConfig(withModules(['batteries']), true);
    const captain = await db.user('Captain', { [TEAM_A]: 'captain' });
    const member = await db.user('Member', { [TEAM_A]: 'member' });
    expect(await db.denied(member, `insert into bat_batteries (label) values ('B1')`)).toBe(true);
    const [{ id }] = await db.as(captain, `insert into bat_batteries (label) values ('B1') returning id`);
    await db.as(member, `insert into bat_logs (battery_id, kind, voltage, by) values ($1, 'tested', 13.1, $2)`, [id, member]);
    await db.admin(`insert into bat_logs (battery_id, kind, at) select $1, 'used', now() - (g || ' minutes')::interval from generate_series(1, 210) g`, [id]);
    expect((await db.admin(`select count(*)::int n from bat_logs`))[0].n).toBe(200);
  });
});
