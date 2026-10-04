import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules, type TestDb } from '../../tools/tests/db/harness';

describe('to manufacture: routing, rules, cleanup', () => {
  let db: TestDb;
  let mentor: string, printer: string, member: string, member2: string;
  let job: string;
  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(
      withModules(['manufacture'], { positions: [{ id: 'pos_3d_print_farm_manager', name: '3D Print Farm Manager', grantsPermissions: true }] }),
      true,
    );
    mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    printer = await db.user('Printer', { [TEAM_A]: 'member' }, { positions: ['pos_3d_print_farm_manager'] });
    member = await db.user('Member', { [TEAM_A]: 'member' });
    member2 = await db.user('Member 2', { [TEAM_A]: 'member' });
  });
  it('new FDM jobs notify the print farm manager and mentors, not other members', async () => {
    [{ id: job }] = await db.as(member, `insert into mfg_jobs (team_id, title, method, requested_by) values ($1, 'Bracket', 'fdm', $2) returning id`, [TEAM_A, member]);
    expect((await db.as(printer, `select type from notifications`)).map((n) => n.type)).toEqual(['manufacture.new_job']);
    expect((await db.as(mentor, `select type from notifications`)).length).toBe(1);
    expect(await db.as(member2, `select * from notifications`)).toEqual([]);
  });
  it('requesters cannot change status; the manager can; requester is notified', async () => {
    expect(await db.denied(member, `update mfg_jobs set status = 'done' where id = $1 returning id`, [job])).toBe(true);
    await db.as(printer, `update mfg_jobs set status = 'in_progress', assigned_to = $2 where id = $1`, [job, printer]);
    expect((await db.as(member, `select type from notifications`)).map((n) => n.type)).toEqual(['manufacture.status']);
    expect(await db.denied(member, `delete from mfg_jobs where id = $1 returning id`, [job])).toBe(true);
  });
  it('CNC managers cannot run the FDM queue', async () => {
    const cnc = await db.user('CNC', { [TEAM_A]: 'member' });
    expect(await db.denied(cnc, `update mfg_jobs set status = 'done' where id = $1 returning id`, [job])).toBe(true);
  });
  it('done jobs set done_at; file deletion queues storage cleanup', async () => {
    await db.as(member, `select 1`);
    await db.admin(`insert into mfg_files (job_id, path, name) values ($1, 'p/j/f.stl.gz', 'f.stl.gz')`, [job]);
    await db.as(printer, `update mfg_jobs set status = 'done' where id = $1`, [job]);
    expect((await db.admin(`select done_at from mfg_jobs where id = $1`, [job]))[0].done_at).toBeTruthy();
    await db.as(printer, `delete from mfg_files where job_id = $1`, [job]);
    expect((await db.admin(`select path from teamhub_storage_trash`)).map((r) => r.path)).toContain('p/j/f.stl.gz');
  });
  it('the cron job SQL uses the configured retention', async () => {
    const { loadCatalog, planSql, resolveConfig } = await import('@teamhub/generator');
    const plan = planSql(resolveConfig(withModules(['manufacture']), await loadCatalog()), null, { cron: true });
    const cron = plan.steps.find((s) => s.title.includes('cleanup jobs'))!.sql;
    expect(cron).toContain(`interval '14 days'`);
  });
});
