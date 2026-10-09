import { describe, expect, it } from 'vitest';
import { expandOccurrences, type CalEvent } from './data';

const ev = (starts_at: string, ends_at: string | null, recurrence: string | null = null): CalEvent => ({
  id: 'e', team_id: null, title: 'Camp', kind: 'outreach', starts_at, ends_at, all_day: true, location: null, notes: null, recurrence, event_code: null, created_by: null, created_at: starts_at,
});

describe('all-day events', () => {
  it('include their last day (the 21st to the 30th ends at midnight after the 30th)', () => {
    const [o] = expandOccurrences([ev('2026-10-21T12:00:00Z', '2026-10-30T12:00:00Z')], [], new Date(2026, 9, 1), new Date(2026, 11, 1));
    expect(o.start).toEqual(new Date(2026, 9, 21));
    expect(o.end).toEqual(new Date(2026, 9, 31));
  });

  it('one-day events end at midnight after their day, and still show on their last day', () => {
    const [o] = expandOccurrences([ev('2026-10-21T12:00:00Z', null)], [], new Date(2026, 9, 21), new Date(2026, 9, 22));
    expect(o.end).toEqual(new Date(2026, 9, 22));
    expect(expandOccurrences([ev('2026-10-21T12:00:00Z', null)], [], new Date(2026, 9, 22), new Date(2026, 9, 23))).toEqual([]);
  });

  it('repeating multi-day events keep whole days across a daylight-saving change', () => {
    const occ = expandOccurrences([ev('2026-10-30T12:00:00Z', '2026-10-31T12:00:00Z', 'FREQ=WEEKLY')], [], new Date(2026, 10, 1), new Date(2026, 10, 10));
    expect(occ[0].start).toEqual(new Date(2026, 10, 6));
    expect(occ[0].end).toEqual(new Date(2026, 10, 8));
  });
});
