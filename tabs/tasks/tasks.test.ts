import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules, type TestDb } from '../../tools/tests/db/harness';

describe('tasks RLS + triggers', () => {
  let db: TestDb;
  let mentor: string, captain: string, member: string, member2: string;
  let id: number;
  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(withModules(['tasks']), true);
    mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    captain = await db.user('Captain', { [TEAM_A]: 'captain' });
    member = await db.user('Member', { [TEAM_A]: 'member' });
    member2 = await db.user('Member 2', { [TEAM_A]: 'member' });
  });
  it('members create (default setting) but only assign themselves', async () => {
    await db.as(member, `insert into task_items (team_id, title, assignee, created_by) values ($1, 'Mine', array[$2]::uuid[], $2)`, [TEAM_A, member]);
    expect(await db.denied(member, `insert into task_items (team_id, title, assignee, created_by) values ($1, 'Yours', array[$2]::uuid[], $3)`, [TEAM_A, member2, member])).toBe(true);
  });
  it('assigning notifies, and done_at is maintained', async () => {
    [{ id }] = await db.as(captain, `insert into task_items (team_id, title, assignee, created_by) values ($1, 'Wire drivetrain', array[$2]::uuid[], $3) returning id`, [TEAM_A, member2, captain]);
    expect((await db.as(member2, `select type, ref from notifications`))).toEqual([{ type: 'tasks.assigned', ref: `tasks:task:${id}` }]);
    await db.as(member2, `update task_items set status = 'done' where id = $1`, [id]);
    const [t] = await db.admin(`select done_at from task_items where id = $1`, [id]);
    expect(t.done_at).toBeTruthy();
  });
  it('comments are visible with the task and notify assignees; deleting removes them', async () => {
    await db.as(captain, `insert into comments (ref, author, body) values ($1, $2, 'Looks good')`, [`tasks:task:${id}`, captain]);
    expect((await db.as(member, `select body from comments`)).map((c) => c.body)).toEqual(['Looks good']);
    expect((await db.as(member2, `select type from notifications order by id`)).map((n) => n.type)).toContain('tasks.comment');
    expect(await db.denied(member, `delete from task_items where id = $1 returning id`, [id])).toBe(true);
    await db.as(mentor, `delete from task_items where id = $1`, [id]);
    expect(await db.admin(`select * from comments`)).toEqual([]);
  });
  it('comments on unknown refs are rejected', async () => {
    expect(await db.denied(member, `insert into comments (ref, author, body) values ('tasks:task:99999', $1, 'x')`, [member])).toBe(true);
  });
});
