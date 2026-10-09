import { beforeAll, describe, expect, it } from 'vitest';
import { loadCatalog } from '@teamhub/generator';
import { createTestDb, TEAM_A, TEAM_B, withModules, type TestDb } from '../../tools/tests/db/harness';

describe('calendar RLS', () => {
  let db: TestDb;
  let admin: string, mentorA: string, captainA: string, memberA: string, memberB: string;
  const ins = (who: string, team: string | null, title: string) =>
    db.as(who, `insert into cal_events (team_id, title, starts_at, created_by) values ($1, $2, now(), $3) returning id`, [team, title, who]);

  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(withModules(['calendar']), true);
    admin = await db.user('Admin', { [TEAM_A]: 'mentor' }, { admin: true });
    mentorA = await db.user('Mentor A', { [TEAM_A]: 'mentor' });
    captainA = await db.user('Captain A', { [TEAM_A]: 'captain' });
    memberA = await db.user('Member A', { [TEAM_A]: 'member' });
    memberB = await db.user('Member B', { [TEAM_B]: 'member' });
  });

  it('captains create, members cannot', async () => {
    await ins(captainA, TEAM_A, 'A practice');
    await ins(mentorA, null, 'Program kickoff');
    expect(await db.denied(memberA, `insert into cal_events (team_id, title, starts_at, created_by) values ($1, 'x', now(), $2)`, [TEAM_A, memberA])).toBe(true);
    expect(await db.denied(captainA, `insert into cal_events (team_id, title, starts_at, created_by) values ($1, 'x', now(), $2)`, [TEAM_B, captainA])).toBe(true);
  });

  it('team-scoped events are invisible to other teams', async () => {
    expect((await db.as(memberA, 'select title from cal_events order by title')).map((r) => r.title)).toEqual(['A practice', 'Program kickoff']);
    expect((await db.as(memberB, 'select title from cal_events')).map((r) => r.title)).toEqual(['Program kickoff']);
  });

  it("captains can't edit others' events; mentors can", async () => {
    expect(await db.denied(captainA, `update cal_events set title = 'hacked' where title = 'Program kickoff' returning id`)).toBe(true);
    const r = await db.as(mentorA, `update cal_events set title = 'Practice A' where title = 'A practice' returning id`);
    expect(r.length).toBe(1);
  });

  it('a cancelled date can be un-cancelled by whoever can edit the event, not by members', async () => {
    const [{ id }] = await db.as(mentorA, `insert into cal_events (team_id, title, starts_at, recurrence, created_by) values ($1, 'Weekly build', now(), 'FREQ=WEEKLY', $2) returning id`, [TEAM_A, mentorA]);
    await db.as(mentorA, `insert into cal_exceptions (event_id, occurrence_date, cancelled) values ($1, current_date, true)`, [id]);
    const restore = `update cal_exceptions set cancelled = false where event_id = $1 returning cancelled`;
    expect(await db.denied(memberA, restore, [id])).toBe(true);
    expect(await db.denied(captainA, restore, [id])).toBe(true);
    expect(await db.as(mentorA, restore, [id])).toEqual([{ cancelled: false }]);
  });

  it('feeds are admin-only and produce an iCal document', async () => {
    expect(await db.denied(mentorA, `insert into cal_feeds (team_id) values (null) returning id`)).toBe(true);
    const [f] = await db.as(admin, `insert into cal_feeds (team_id) values ($1) returning token`, [TEAM_B]);
    expect(await db.as(mentorA, 'select * from cal_feeds')).toEqual([]);
    const [{ ics }] = await db.admin('select cal_ical($1) ics', [f.token]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Program kickoff');
    expect(ics).not.toContain('Practice A');
    expect((await db.admin(`select cal_ical('nope') ics`))[0].ics).toBeNull();
    expect(await db.denied(null, `select cal_ical($1)`, [f.token])).toBe(true);
  });

  it('a competition is on the calendar once per team (two teams at the same event = two events)', async () => {
    const comp = (team: string | null, code: string) =>
      db.as(mentorA, `insert into cal_events (team_id, title, kind, event_code, starts_at, created_by) values ($1, 'Qualifier', 'competition', $2, now(), $3) returning id`, [team, code, mentorA]);
    await comp(TEAM_A, 'USNYQ1');
    await expect(comp(TEAM_A, 'usnyq1')).rejects.toThrow(/duplicate|unique/);
    await db.as(admin, `insert into cal_events (team_id, title, kind, event_code, starts_at, created_by) values ($1, 'Qualifier', 'competition', 'USNYQ1', now(), $2)`, [TEAM_B, admin]);
    expect((await db.admin(`select count(*)::int n from cal_events where upper(event_code) = 'USNYQ1'`))[0].n).toBe(2);
  });
});

/** 003: a multi-day event's end date is now its last day, so updating moves end dates people entered as "the day after" back one day. */
describe('inclusive last day on update', () => {
  it('moves multi-day end dates back one day, but not FTCScout competitions or timed events', async () => {
    const now = await loadCatalog();
    const cal = now.modules.get('calendar')!;
    const migrations = cal.migrations.filter((m) => m.name < '003_');
    const before = { ...now, modules: new Map(now.modules).set('calendar', { ...cal, migrations, version: migrations.length }) };
    const db = await createTestDb();
    await db.applyConfig(withModules(['calendar']), true, before);
    await db.admin(`insert into cal_events (title, kind, all_day, starts_at, ends_at, event_code) values
      ('Camp', 'outreach', true, '2026-10-21T12:00:00Z', '2026-10-31T12:00:00Z', null),
      ('Two days', 'social', true, '2026-11-02T12:00:00Z', '2026-11-03T12:00:00Z', null),
      ('One day', 'social', true, '2026-11-05T12:00:00Z', null, null),
      ('Championship', 'competition', true, '2026-12-05T12:00:00Z', '2026-12-06T12:00:00Z', 'USNYCMP'),
      ('Practice', 'practice', false, '2026-11-10T19:00:00Z', '2026-11-10T22:00:00Z', null)`);
    await db.applyConfig(withModules(['calendar']));
    const rows = await db.admin(`select title, to_char(ends_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') ends from cal_events order by starts_at`);
    expect(rows).toEqual([
      { title: 'Camp', ends: '2026-10-30 12:00' },
      { title: 'Two days', ends: null },
      { title: 'One day', ends: null },
      { title: 'Practice', ends: '2026-11-10 22:00' },
      { title: 'Championship', ends: '2026-12-06 12:00' },
    ]);
  }, 120_000);
});
