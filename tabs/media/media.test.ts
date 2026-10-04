import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, withModules } from '../../tools/tests/db/harness';

describe('media', () => {
  it('limits photos per album, trashes files on delete, and respects the members setting', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['media'], { modules: { media: { state: 'active', settings: { maxPhotosPerAlbum: 5 } } } }), true);
    const cap = await db.user('Cap', { [TEAM_A]: 'captain' });
    const a = await db.user('A', { [TEAM_A]: 'member' });
    expect(await db.denied(a, `insert into med_albums (team_id, title, created_by) values ($1, 'Kickoff', $2)`, [TEAM_A, a])).toBe(true);
    const [{ id }] = await db.as(cap, `insert into med_albums (team_id, title, created_by) values ($1, 'Kickoff', $2) returning id`, [TEAM_A, cap]);
    for (let i = 0; i < 5; i++) await db.as(cap, `insert into med_items (album_id, kind, path, uploaded_by) values ($1, 'photo', $2, $3)`, [id, `${TEAM_A}/${id}/${i}.webp`, cap]);
    await expect(db.as(cap, `insert into med_items (album_id, kind, path, uploaded_by) values ($1, 'photo', 'x.webp', $2)`, [id, cap])).rejects.toThrow(/full \(5 photos\)/);
    await db.as(cap, `insert into med_items (album_id, kind, url, uploaded_by) values ($1, 'link', 'https://youtu.be/x', $2)`, [id, cap]);
    await db.as(cap, 'delete from med_albums where id = $1', [id]);
    expect((await db.admin(`select count(*)::int n from teamhub_storage_trash where bucket = 'media'`))[0].n).toBe(5);
    await db.applyConfig(withModules(['media'], { modules: { media: { state: 'active', settings: { membersCanUpload: true } } } }));
    await db.as(a, `insert into med_albums (team_id, title, created_by) values ($1, 'Mine', $2)`, [TEAM_A, a]);
  });
});
