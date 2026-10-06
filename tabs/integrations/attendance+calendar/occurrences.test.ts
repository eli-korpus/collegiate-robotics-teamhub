import { describe, expect, it } from 'vitest';
import { expandAttendable, type EventRow } from './occurrences';

const at = (y: number, m: number, d: number, h = 15) => new Date(y, m - 1, d, h, 30);
const ev = (id: string, kind: string, start: Date, recurrence: string | null = null): EventRow => ({
  id, title: id, kind, team_id: null, starts_at: start.toISOString(), ends_at: null, all_day: false, recurrence,
});

describe('calendar events you can take attendance for', () => {
  // The week of Mon Oct 5 – Sun Oct 11, 2026.
  const from = new Date(2026, 9, 5);
  const to = new Date(2026, 9, 12);

  it('includes practices, meetings, competitions and outreach, but not deadlines', () => {
    const list = expandAttendable(
      [ev('practice', 'practice', at(2026, 10, 6)), ev('qualifier', 'competition', at(2026, 10, 10, 8)), ev('library', 'outreach', at(2026, 10, 8)), ev('forms due', 'deadline', at(2026, 10, 7))],
      [], from, to,
    );
    expect(list.map((o) => o.title)).toEqual(['practice', 'library', 'qualifier']);
  });

  it('expands repeating practices and skips cancelled dates', () => {
    const weekly = ev('build', 'practice', at(2026, 9, 1), 'FREQ=WEEKLY;BYDAY=TU,TH');
    const list = expandAttendable([weekly], [{ event_id: 'build', occurrence_date: '2026-10-08', cancelled: true, override: null }], from, to);
    expect(list.map((o) => o.date)).toEqual(['2026-10-06']);
  });

  it('uses a moved time or new title for one date', () => {
    const weekly = ev('build', 'practice', at(2026, 9, 1), 'FREQ=WEEKLY;BYDAY=TU');
    const [o] = expandAttendable([weekly], [{ event_id: 'build', occurrence_date: '2026-10-06', cancelled: false, override: { title: 'Build (gym)', starts_at: at(2026, 10, 6, 17).toISOString() } }], from, to);
    expect(o.title).toBe('Build (gym)');
    expect(o.start.getHours()).toBe(17);
  });

  it('leaves out events outside the dates', () => {
    expect(expandAttendable([ev('old', 'practice', at(2026, 9, 20))], [], from, to)).toEqual([]);
  });
});
