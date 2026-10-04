import { describe, expect, it } from 'vitest';
import type { FtcMatch } from '@teamhub/sdk/ftcscout';
import { compositeScores, coverage, fieldAverages, highlights, matchHistory, stdev, trend } from './insights';

const m = (id: number, red: number[], blue: number[], rs: number | null, bs: number | null): FtcMatch => ({
  id,
  matchNum: id,
  series: 0,
  tournamentLevel: 'Quals',
  description: null,
  hasBeenPlayed: rs != null,
  scheduledStartTime: null,
  actualStartTime: null,
  teams: [...red.map((t) => ({ teamNumber: t, alliance: 'Red' as const, station: 'One' })), ...blue.map((t) => ({ teamNumber: t, alliance: 'Blue' as const, station: 'One' }))],
  scores: rs == null ? null : { red: { totalPoints: rs, totalPointsNp: rs }, blue: { totalPoints: bs!, totalPointsNp: bs! } },
});

describe('scouting insights', () => {
  const matches = [m(1, [1, 2], [3, 4], 50, 40), m(2, [1, 3], [2, 4], 60, 70), m(3, [1, 4], [2, 3], 80, 20), m(4, [1, 2], [3, 4], null, null)];
  it('builds per-team match history with wins and alliance scores', () => {
    const h = matchHistory(matches, 1);
    expect(h.map((x) => x.score)).toEqual([50, 60, 80]);
    expect(h.map((x) => x.won)).toEqual([true, false, true]);
    expect(trend(h.map((x) => x.score))).toBe(15);
    expect(stdev([50, 60, 80])).toBeCloseTo(15.28, 1);
  });
  it('averages numeric fields and finds strengths vs the event', () => {
    const fields = [
      { id: 'c', label: 'Cycles', type: 'counter' as const },
      { id: 'p', label: 'Parks', type: 'checkbox' as const },
      { id: 'n', label: 'Notes', type: 'text' as const },
    ];
    const team = fieldAverages(fields, [{ c: 6, p: true }, { c: 8, p: true }]);
    expect(team).toEqual({ c: 7, p: 1 });
    const ev = { c: 4, p: 0.5 };
    const h = highlights(fields, team, ev);
    expect(h.strengths.map((x) => x.label)).toEqual(['Parks', 'Cycles']);
  });
  it('ranks teams by combined z-scores', () => {
    const s = compositeScores(
      [
        { team: 1, opr: 50, fields: { c: 7 } },
        { team: 2, opr: 30, fields: { c: 3 } },
        { team: 3, opr: null, fields: {} },
      ],
      ['c'],
    );
    expect(s.get(1)!).toBeGreaterThan(s.get(2)!);
    expect(s.get(3)).toBeNull();
  });
  it('finds unscouted teams and their next matches', () => {
    const c = coverage([1, 2, 3, 4], new Map([[1, 2], [2, 1]]), matches, 1);
    expect(c.unscouted).toEqual([3, 4]);
    expect(c.upcoming).toEqual([{ label: 'Q4', teams: [3, 4] }]);
  });
});
