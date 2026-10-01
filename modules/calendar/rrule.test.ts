import { describe, expect, it } from 'vitest';
import { expand, formatRule, parseRule, describeRule } from './rrule';

const d = (s: string) => new Date(s);

describe('rrule subset', () => {
  it('expands weekly BYDAY practices within a range', () => {
    const r = parseRule('FREQ=WEEKLY;BYDAY=TU,TH')!;
    const out = expand(d('2026-10-06T15:30:00'), r, d('2026-10-01T00:00:00'), d('2026-10-20T00:00:00'));
    expect(out.map((x) => x.getDate())).toEqual([6, 8, 13, 15]);
    expect(out[0].getHours()).toBe(15);
  });
  it('respects COUNT and UNTIL', () => {
    expect(expand(d('2026-10-01T10:00:00'), parseRule('FREQ=DAILY;COUNT=3')!, d('2026-09-01'), d('2026-12-01'))).toHaveLength(3);
    const u = expand(d('2026-10-01T10:00:00'), parseRule('FREQ=WEEKLY;UNTIL=20261022')!, d('2026-09-01'), d('2026-12-01'));
    expect(u.map((x) => x.getDate())).toEqual([1, 8, 15, 22]);
  });
  it('supports intervals and monthly', () => {
    expect(expand(d('2026-10-01T10:00:00'), parseRule('FREQ=WEEKLY;INTERVAL=2')!, d('2026-10-01'), d('2026-11-01')).length).toBe(3);
    expect(expand(d('2026-01-31T10:00:00'), parseRule('FREQ=MONTHLY')!, d('2026-01-01'), d('2026-06-01')).map((x) => x.getMonth())).toEqual([0, 2, 4]);
  });
  it('round-trips and describes', () => {
    const r = parseRule('FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20270101')!;
    expect(parseRule(formatRule(r))).toEqual(r);
    expect(describeRule(r)).toMatch(/^Weekly on Mon, Wed until/);
  });
});
