import { describe, expect, it } from 'vitest';
import type { FtcTeamEvent } from '@teamhub/sdk';
import { competitionGreeting } from './greeting';

const ev = (start: string, end = start, type = 'Qualifier', finished = false): FtcTeamEvent => ({
  eventCode: start,
  event: { code: start, name: 'Test', start, end, type, timezone: null, location: null, finished },
  stats: null,
  awards: [],
});
const now = new Date(2026, 9, 2, 15); // Fri Oct 2, 2026

describe('competition greeting', () => {
  it('counts down the last week', () => {
    expect(competitionGreeting([ev('2026-10-05')], now)).toBe('3 days to the qualifier');
    expect(competitionGreeting([ev('2026-10-03', '2026-10-03', 'LeagueMeet')], now)).toBe('League meet tomorrow');
    expect(competitionGreeting([ev('2026-10-02')], now)).toBe('Competition day');
  });

  it('says competition day on every day of a multi-day event', () => {
    expect(competitionGreeting([ev('2026-10-01', '2026-10-03', 'Championship')], now)).toBe('Competition day');
  });

  it('picks the soonest competition', () => {
    expect(competitionGreeting([ev('2026-10-08'), ev('2026-10-04', '2026-10-04', 'Scrimmage')], now)).toBe('2 days to the scrimmage');
  });

  it('stays quiet when nothing is close, it is over, or it is not a competition', () => {
    expect(competitionGreeting([ev('2026-10-12')], now)).toBeNull();
    expect(competitionGreeting([ev('2026-09-30')], now)).toBeNull();
    expect(competitionGreeting([ev('2026-10-02', '2026-10-02', 'Qualifier', true)], now)).toBeNull();
    expect(competitionGreeting([ev('2026-10-03', '2026-10-03', 'Kickoff')], now)).toBeNull();
    expect(competitionGreeting([], now)).toBeNull();
  });
});
