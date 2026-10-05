import { describe, expect, it } from 'vitest';
import { cleanText, mergeTeams, parseTeamNumbers, renderTeamsPage, type ListedTeam } from '../../scripts/github/team-signup';
import { mergeTraffic, renderSummary } from '../../scripts/github/traffic-history';

const form = (teams: string) => `### FTC team number(s)\n\n${teams}\n\n### Anything you'd like to tell us? (optional)\n\n67890 is our sister team\n`;

describe('team sign-ups', () => {
  it('reads only the team number answer', () => {
    expect(parseTeamNumbers(form('12345, 67890'))).toEqual([12345, 67890]);
    expect(parseTeamNumbers(form('Team #12345 and 12345'))).toEqual([12345]);
    expect(parseTeamNumbers('no form here 12345')).toEqual([]);
  });

  it('keeps long numbers whole so they can be reported as not found', () => {
    expect(parseTeamNumbers(form('99999999'))).toEqual([99999999]);
  });

  it('strips anything that could break the table or add links', () => {
    expect(cleanText('Robo|ts [x](javascript:1) <b>')).toBe('Robo ts x javascript:1 b');
    expect(cleanText('a'.repeat(200))).toHaveLength(80);
  });

  it('keeps the first sign-up date and lists oldest first', () => {
    const a: ListedTeam = { number: 1, name: 'One', location: 'A, USA', joined: '2026-10-01', issue: 1 };
    const b: ListedTeam = { number: 2, name: 'Two', location: 'B, Canada', joined: '2026-10-02', issue: 2 };
    const merged = mergeTeams([a], [b, { ...a, joined: '2026-10-05', issue: 9, name: 'One renamed' }]);
    expect(merged.map((t) => [t.number, t.joined, t.issue, t.name])).toEqual([
      [1, '2026-10-01', 1, 'One renamed'],
      [2, '2026-10-02', 2, 'Two'],
    ]);
    expect(renderTeamsPage(merged)).toContain('**2 teams** in 2 countries');
  });
});

describe('usage history', () => {
  it('keeps days older than GitHub\'s 14-day window and updates partial days', () => {
    const old = { '2026-01-01': { views: 5, clones: 1 }, '2026-02-01': { views: 1, stars: 3 } };
    const h = mergeTraffic(old, [{ timestamp: '2026-02-01T00:00:00Z', count: 9, uniques: 4 }], [{ timestamp: '2026-02-02T00:00:00Z', count: 2, uniques: 2 }]);
    expect(h['2026-01-01']).toEqual({ views: 5, clones: 1 });
    expect(h['2026-02-01']).toEqual({ views: 9, visitors: 4, stars: 3 });
    expect(Object.keys(h)).toEqual(['2026-01-01', '2026-02-01', '2026-02-02']);
  });

  it('adds up totals and explains a missing token', () => {
    const md = renderSummary('o/r', { '2026-01-01': { views: 5, clones: 2, stars: 1, forks: 0 }, '2026-01-02': { views: 1, clones: 1, stars: 2, forks: 1 } }, [], [], false, '2026-01-02');
    expect(md).toContain('| Stars | 2 |');
    expect(md).toContain('| Downloads (git clones) since 2026-01-01 | 3 |');
    expect(md).toContain('TRAFFIC_TOKEN');
  });
});
