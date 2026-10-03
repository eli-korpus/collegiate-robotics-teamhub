/**
 * Adds teams from a "We're using TeamHub" issue (.github/ISSUE_TEMPLATE/teamhub-team.yml) to TEAMS.md.
 * Run by .github/workflows/team-signups.yml in the upstream repository only, with plain Node (no npm install).
 *
 * The issue text is untrusted: only team numbers are read from it. Names and locations come from FTCScout, so
 * nobody can put arbitrary text in TEAMS.md.
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export interface ListedTeam {
  number: number;
  name: string;
  location: string;
  /** YYYY-MM-DD of the first sign-up. */
  joined: string;
  issue: number;
}

const DATA = '.github/data/teams.json';
const PAGE = 'TEAMS.md';
const MAX_TEAMS_PER_ISSUE = 10;

/** Team numbers from the "FTC team number(s)" answer of an issue form body. */
export function parseTeamNumbers(body: string): number[] {
  const m = /###\s*FTC team number\(s\)\s*\n+([^\n]*)/i.exec(body ?? '');
  if (!m) return [];
  const nums = (m[1].match(/\d+/g) ?? []).map(Number).filter((n) => n > 0);
  return [...new Set(nums)].slice(0, MAX_TEAMS_PER_ISSUE);
}

/** Plain text that can't break the Markdown table or add links/HTML. */
export function cleanText(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/[\p{Cc}<>[\]()|`*_~#\\]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** Adds or keeps teams (the first sign-up date and issue win). */
export function mergeTeams(existing: ListedTeam[], added: ListedTeam[]): ListedTeam[] {
  const byNumber = new Map(existing.map((t) => [t.number, t]));
  for (const t of added) {
    const old = byNumber.get(t.number);
    byNumber.set(t.number, old ? { ...old, name: t.name, location: t.location } : t);
  }
  return [...byNumber.values()].sort((a, b) => a.joined.localeCompare(b.joined) || a.number - b.number);
}

export function renderTeamsPage(teams: ListedTeam[]): string {
  const places = new Set(teams.map((t) => t.location.split(', ').at(-1)).filter(Boolean));
  const rows = teams.map((t) => `| [${t.number}](https://ftcscout.org/teams/${t.number}) | ${t.name} | ${t.location || ' '} | ${t.joined} |`);
  return [
    '# Teams using TeamHub FTC',
    '',
    'TeamHub FTC is made by [FTC Team 23208](https://ftcscout.org/teams/23208) and shared free with every FTC team.',
    'These teams told us they use it. Using TeamHub too?',
    '[Add your team](https://github.com/elikorpus/teamhub-ftc/issues/new?template=teamhub-team.yml) (the setup wizard has',
    'the same button on its last screen).',
    '',
    `**${teams.length} team${teams.length === 1 ? '' : 's'}**${places.size ? ` in ${places.size} ${places.size === 1 ? 'country' : 'countries'}` : ''}.`,
    '',
    '| Team | Name | Location | Joined |',
    '|---|---|---|---|',
    ...rows,
    '',
    'This page is updated automatically from sign-ups. Names and locations come from [FTCScout](https://ftcscout.org).',
    'To be removed, open an issue or edit `.github/data/teams.json`.',
    '',
  ].join('\n');
}

async function lookup(number: number): Promise<{ name: string; location: string } | null> {
  const res = await fetch('https://api.ftcscout.org/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'query($n: Int!) { teamByNumber(number: $n) { name location { city state country } } }', variables: { n: number } }),
  });
  if (!res.ok) throw new Error(`FTCScout answered ${res.status}`);
  const d = (await res.json()) as { data?: { teamByNumber: { name: string; location: { city: string; state: string; country: string } | null } | null } };
  const t = d.data?.teamByNumber;
  if (!t) return null;
  const loc = t.location;
  return { name: cleanText(t.name), location: loc ? [loc.city, loc.state, loc.country].map(cleanText).filter(Boolean).join(', ') : '' };
}

async function main() {
  const body = process.env.ISSUE_BODY ?? '';
  const issue = Number(process.env.ISSUE_NUMBER);
  const today = new Date().toISOString().slice(0, 10);
  const numbers = parseTeamNumbers(body);
  const found: ListedTeam[] = [];
  const missing: number[] = [];
  for (const n of numbers) {
    const t = n < 1_000_000 ? await lookup(n) : null;
    if (t) found.push({ number: n, ...t, joined: today, issue });
    else missing.push(n);
  }
  const existing: ListedTeam[] = existsSync(DATA) ? JSON.parse(readFileSync(DATA, 'utf8')) : [];
  const teams = mergeTeams(existing, found);
  writeFileSync(DATA, JSON.stringify(teams, null, 2) + '\n');
  writeFileSync(PAGE, renderTeamsPage(teams));

  const lines: string[] = [];
  if (found.length) {
    lines.push(`Thanks for using TeamHub FTC! ${found.map((t) => `**${t.number} ${t.name}**`).join(', ')} ${found.length === 1 ? 'is' : 'are'} now on the [list of teams using TeamHub](../blob/main/TEAMS.md).`);
    lines.push('', 'Good luck this season from FTC Team 23208.');
  }
  if (missing.length) lines.push('', `We couldn't find ${missing.join(', ')} on FTCScout. Edit this issue with the right number and we'll try again.`);
  if (!numbers.length) lines.push("We couldn't find a team number in this issue. Edit it and add your FTC team number, and we'll try again.");
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    appendFileSync(out, `listed=${found.length}\n`);
    appendFileSync(out, `comment<<TEAMHUB_EOF\n${lines.join('\n')}\nTEAMHUB_EOF\n`);
  } else console.log(lines.join('\n'));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
