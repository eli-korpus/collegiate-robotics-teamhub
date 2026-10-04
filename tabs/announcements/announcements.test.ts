import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, TEAM_B, withModules, type TestDb } from '../../tools/tests/db/harness';

describe('announcements RLS', () => {
  let db: TestDb;
  let mentor: string, captain: string, member: string, memberB: string;
  let postId: string;
  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(withModules(['announcements']), true);
    mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    captain = await db.user('Captain', { [TEAM_A]: 'captain' });
    member = await db.user('Member', { [TEAM_A]: 'member' });
    memberB = await db.user('Member B', { [TEAM_B]: 'member' });
  });
  it('captains post; must-read notifies the team only', async () => {
    [{ id: postId }] = await db.as(captain, `insert into ann_posts (team_id, title, require_ack, created_by) values ($1, 'Travel', true, $2) returning id`, [TEAM_A, captain]);
    expect((await db.as(member, `select ref from notifications`)).map((r) => r.ref)).toEqual([`announcements:post:${postId}`]);
    expect(await db.as(memberB, `select * from notifications`)).toEqual([]);
    expect(await db.as(memberB, `select * from ann_posts`)).toEqual([]);
    expect(await db.denied(member, `insert into ann_posts (title, created_by) values ('x', $1)`, [member])).toBe(true);
  });
  it('acks are personal; captains see who read', async () => {
    await db.as(member, `insert into ann_acks (post_id, user_id) values ($1, $2)`, [postId, member]);
    expect(await db.denied(member, `insert into ann_acks (post_id, user_id) values ($1, $2)`, [postId, mentor])).toBe(true);
    expect((await db.as(captain, `select user_id from ann_acks`)).length).toBe(1);
    const [{ id: other }] = await db.as(mentor, `insert into ann_posts (title, created_by) values ('FYI', $1) returning id`, [mentor]);
    expect(await db.denied(member, `insert into ann_acks (post_id, user_id) values ($1, $2)`, [other, member])).toBe(true);
  });
  it('deleting a post with an image queues the file for cleanup', async () => {
    await db.as(captain, `update ann_posts set image_path = 'x/y/z.webp' where id = $1`, [postId]);
    expect(await db.denied(member, `delete from ann_posts where id = $1 returning id`, [postId])).toBe(true);
    await db.as(mentor, `delete from ann_posts where id = $1`, [postId]);
    expect((await db.admin(`select path from teamhub_storage_trash`)).map((r) => r.path)).toContain('x/y/z.webp');
  });
});
