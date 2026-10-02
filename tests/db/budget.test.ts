import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, TEAM_B, withModules } from './harness';

const ALL = Object.keys(JSON.parse(readFileSync('examples/demo.config.json', 'utf8')).modules);
const LIMIT_MB = 25;

/**
 * DB budget (spec §16.5): a "typical season" (20 people, every tab, generous activity) stays ≤ 25 MB,
 * so a free Supabase project (500 MB) lasts for years.
 */
describe('DB budget', () => {
  it(`a typical season with all ${ALL.length} tabs fits in ${LIMIT_MB} MB`, async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(ALL), true);
    const people: string[] = [];
    for (let i = 0; i < 20; i++) people.push(await db.user(`Person ${i}`, { [i % 2 ? TEAM_B : TEAM_A]: i < 3 ? 'mentor' : i < 6 ? 'captain' : 'member' }));
    await db.admin(`create temporary table p as select unnest($1::uuid[]) id`, [people]);
    const text = (n: number) => `repeat('Lorem ipsum dolor sit amet, robot intake design notes. ', ${Math.ceil(n / 54)})`;
    await db.exec(`
      insert into cal_events (team_id, title, starts_at, kind) select '${TEAM_A}', 'Practice ' || g, now() + g * interval '1 day', 'practice' from generate_series(1, 150) g;
      insert into att_sessions (team_id, date, title) select '${TEAM_A}', current_date - g, 'Practice' from generate_series(1, 100) g;
      insert into att_presence (session_id, user_id) select s.id, p.id from att_sessions s cross join (select id from p limit 18) p;
      insert into ann_posts (title, body) select 'Announcement ' || g, ${text(800)} from generate_series(1, 60) g;
      insert into ann_acks (post_id, user_id) select a.id, p.id from ann_posts a cross join (select id from p limit 15) p;
      insert into task_items (team_id, title, description) select '${TEAM_A}', 'Task ' || g, ${text(300)} from generate_series(1, 300) g;
      insert into nb_entries (team_id, title, body) select '${TEAM_A}', 'Entry ' || g, ${text(3000)} from generate_series(1, 200) g;
      insert into comments (ref, body) select 'tasks:task:' || g, ${text(200)} from generate_series(1, 600) g;
      insert into notifications (user_id, type, ref) select p.id, 'mention', 'tasks:task:' || g from p cross join generate_series(1, 150) g;
      insert into sct_entries (event_code, team_number, kind, match_label, data)
        select 'EV' || e, 10000 + t, case when m = 0 then 'pit' else 'match' end, case when m = 0 then null else 'Q' || m end,
          jsonb_build_object('auto', m, 'teleop', t, 'notes', ${text(300)}, 'drivetrain', 'mecanum', 'climb', true)
        from generate_series(1, 3) e, generate_series(1, 32) t, generate_series(0, 6) m;
      insert into chk_lists (name, items) select 'List ' || g, (select jsonb_agg(jsonb_build_object('id', i::text, 'label', 'Check ' || i)) from generate_series(1, 25) i) from generate_series(1, 10) g;
      insert into chk_runs (list_id, checked) select l.id, '["1","2","3"]' from chk_lists l, generate_series(1, 20);
      insert into bat_batteries (label) select 'B' || g from generate_series(1, 12) g;
      insert into bat_logs (battery_id, kind, voltage) select b.id, 'charged', 13.1 from bat_batteries b, generate_series(1, 80);
      insert into inv_items (name, qty) select 'Part ' || g, g from generate_series(1, 300) g;
      insert into rep_issues (title, cause, fix) select 'Issue ' || g, ${text(400)}, ${text(400)} from generate_series(1, 60) g;
      insert into drv_runs (score, notes) select g, 'ok' from generate_series(1, 400) g;
      insert into out_events (title, date, people_reached) select 'Outreach ' || g, current_date - g, 50 from generate_series(1, 30) g;
      insert into out_hours (event_id, user_id, hours) select e.id, p.id, 2 from out_events e cross join (select id from p limit 10) p;
      insert into poll_polls (kind, question, options, visibility) select 'choice', 'Poll ' || g, '["a","b","c"]', 'public' from generate_series(1, 30) g;
      insert into poll_votes (poll_id, user_id, value) select x.id, p.id, '[1]' from poll_polls x cross join (select id from p limit 15) p;
      insert into pur_requests (item) select 'Thing ' || g from generate_series(1, 80) g;
      insert into mfg_jobs (title, method) select 'Part ' || g, 'fdm' from generate_series(1, 120) g;
      insert into links (label, url) select 'Link ' || g, 'https://example.com/' || g from generate_series(1, 100) g;
      insert into soc_posts (caption) select ${text(400)} from generate_series(1, 60);
      insert into spn_sponsors (name, notes) select 'Sponsor ' || g, ${text(300)} from generate_series(1, 40) g;
    `);
    const [{ bytes }] = await db.admin<{ bytes: string }>(
      `select sum(pg_total_relation_size(c.oid))::bigint bytes from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'm')`,
    );
    const mb = Number(bytes) / 1024 / 1024;
    console.log(`typical season: ${mb.toFixed(1)} MB across all public tables`);
    expect(mb).toBeLessThanOrEqual(LIMIT_MB);
  }, 180_000);
});
