import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules } from '../../tools/tests/db/harness';

describe('polls visibility', () => {
  it('results-only polls hide individual answers but show totals; private hides both', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['polls']), true);
    const captain = await db.user('Captain', { [TEAM_A]: 'captain' });
    const mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    const a = await db.user('A', { [TEAM_A]: 'member' });
    const b = await db.user('B', { [TEAM_A]: 'member' });
    const [{ id: results }] = await db.as(captain, `insert into poll_polls (kind, question, options, visibility, created_by) values ('choice', 'Design?', '["A","B"]', 'results', $1) returning id`, [captain]);
    const [{ id: priv }] = await db.as(captain, `insert into poll_polls (kind, question, options, visibility, created_by) values ('choice', 'How is it going?', '["Good","Bad"]', 'private', $1) returning id`, [captain]);
    for (const [u, v] of [[a, '[0]'], [b, '[1]']]) {
      await db.as(u, `insert into poll_votes (poll_id, user_id, value) values ($1, $2, $3)`, [results, u, v]);
      await db.as(u, `insert into poll_votes (poll_id, user_id, value) values ($1, $2, $3)`, [priv, u, v]);
    }
    expect((await db.as(a, 'select user_id from poll_votes where poll_id = $1', [results])).map((r) => r.user_id)).toEqual([a]);
    expect((await db.as(a, 'select poll_totals($1) t', [results]))[0].t).toEqual({ counts: [1, 1], voters: 2 });
    expect((await db.as(a, 'select poll_totals($1) t', [priv]))[0].t).toBeNull();
    expect((await db.as(mentor, 'select poll_totals($1) t', [priv]))[0].t.voters).toBe(2);
    expect((await db.as(captain, 'select user_id from poll_votes where poll_id = $1', [priv])).length).toBe(2);
    expect(await db.denied(a, `insert into poll_votes (poll_id, user_id, value) values ($1, $2, '[0]')`, [results, b])).toBe(true);
  });
  it('rejects public short-answer polls and answers after closing', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['polls']), true);
    const mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    const a = await db.user('A', { [TEAM_A]: 'member' });
    expect(await db.denied(mentor, `insert into poll_polls (kind, question, visibility, created_by) values ('text', 'Q', 'public', $1)`, [mentor])).toBe(true);
    const [{ id }] = await db.as(mentor, `insert into poll_polls (kind, question, options, visibility, closes_at, created_by) values ('choice', 'Q', '["x","y"]', 'public', now() - interval '1 hour', $1) returning id`, [mentor]);
    expect(await db.denied(a, `insert into poll_votes (poll_id, user_id, value) values ($1, $2, '[0]')`, [id, a])).toBe(true);
  });
});

describe('editing polls', () => {
  it('the question can be fixed until someone answers', async () => {
    const { createTestDb, TEAM_A, withModules } = await import('../../tools/tests/db/harness');
    const db = await createTestDb();
    await db.applyConfig(withModules(['polls']), true);
    const cap = await db.user('Cap', { [TEAM_A]: 'captain' });
    const a = await db.user('A', { [TEAM_A]: 'member' });
    const [{ id }] = await db.as(cap, `insert into poll_polls (kind, question, options, visibility, created_by) values ('choice', 'Pizza or tacoz?', '["Pizza","Tacoz"]', 'public', $1) returning id`, [cap]);
    await db.as(cap, `update poll_polls set question = 'Pizza or tacos?', options = '["Pizza","Tacos"]' where id = $1`, [id]);
    await db.as(a, `insert into poll_votes (poll_id, user_id, value) values ($1, $2, '[1]')`, [id, a]);
    await expect(db.as(cap, `update poll_polls set options = '["Pizza","Burgers"]' where id = $1`, [id])).rejects.toThrow(/already answered/);
    await db.as(cap, `update poll_polls set closes_at = now() + interval '1 day' where id = $1`, [id]);
  });
});
