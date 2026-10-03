/**
 * Keeps a permanent history of the TeamHub repository's stars, forks, views and downloads (clones).
 * GitHub only keeps view and clone counts for 14 days, so .github/workflows/traffic-history.yml runs this daily and
 * saves the numbers on the `traffic` branch, with a readable summary in its README.md.
 *
 * Usage: node scripts/github/traffic-history.ts <folder>   (plain Node, no npm install)
 * Env: GITHUB_REPOSITORY, GH_TOKEN (stars, forks), TRAFFIC_TOKEN (views and clones; optional, see docs/releasing.md).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface Day {
  views?: number;
  visitors?: number;
  clones?: number;
  cloners?: number;
  stars?: number;
  forks?: number;
}
export type History = Record<string, Day>;
export interface Fork {
  name: string;
  url: string;
  created: string;
}
export interface Referrer {
  referrer: string;
  count: number;
  uniques: number;
}
interface TrafficDay {
  timestamp: string;
  count: number;
  uniques: number;
}

/** Merges GitHub's last-14-days counts into the history. Newer numbers for a day replace older (partial) ones. */
export function mergeTraffic(history: History, views: TrafficDay[], clones: TrafficDay[]): History {
  const out: History = { ...history };
  for (const v of views) {
    const d = v.timestamp.slice(0, 10);
    out[d] = { ...out[d], views: v.count, visitors: v.uniques };
  }
  for (const c of clones) {
    const d = c.timestamp.slice(0, 10);
    out[d] = { ...out[d], clones: c.count, cloners: c.uniques };
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

const sum = (h: History, k: keyof Day, from = '') => Object.entries(h).reduce((n, [d, v]) => n + (d >= from ? (v[k] ?? 0) : 0), 0);
const n = (v: number | undefined) => (v === undefined ? ' ' : String(v));

export function renderSummary(repo: string, h: History, forks: Fork[], referrers: Referrer[], hasTraffic: boolean, today: string): string {
  const days = Object.keys(h);
  const latest = [...days].reverse().find((d) => h[d].stars !== undefined);
  const first = days[0] ?? today;
  const months = new Map<string, Day>();
  for (const [d, v] of Object.entries(h)) {
    const m = months.get(d.slice(0, 7)) ?? {};
    months.set(d.slice(0, 7), { views: (m.views ?? 0) + (v.views ?? 0), clones: (m.clones ?? 0) + (v.clones ?? 0), stars: v.stars ?? m.stars, forks: v.forks ?? m.forks });
  }
  const recent = days.slice(-30).reverse();
  return [
    `# TeamHub FTC usage history`,
    '',
    `Saved daily from GitHub by \`.github/workflows/traffic-history.yml\` (GitHub itself only keeps views and downloads for`,
    `14 days). Last updated ${today}. Raw numbers: \`data/daily.json\`.`,
    '',
    '## Totals',
    '',
    '| | |',
    '|---|---|',
    `| Stars | ${latest ? h[latest].stars : 0} |`,
    `| Forks (team copies on GitHub) | ${latest ? h[latest].forks : 0} |`,
    `| Teams signed up | see [TEAMS.md](https://github.com/${repo}/blob/main/TEAMS.md) |`,
    `| Downloads (git clones) since ${first} | ${sum(h, 'clones')} |`,
    `| Page views since ${first} | ${sum(h, 'views')} |`,
    '',
    hasTraffic
      ? 'Downloads count `git clone` only. "Download ZIP" isn\'t counted by GitHub. Daily visitors and cloners are unique per day, so they can\'t be added up into an all-time unique count.'
      : '**Views and downloads aren\'t being saved yet:** add the `TRAFFIC_TOKEN` secret (see `docs/releasing.md` > Usage history). Stars and forks are saved without it.',
    '',
    '## By month',
    '',
    '| Month | Page views | Downloads | Stars (end) | Forks (end) |',
    '|---|---|---|---|---|',
    ...[...months.entries()].reverse().map(([m, v]) => `| ${m} | ${v.views} | ${v.clones} | ${n(v.stars)} | ${n(v.forks)} |`),
    '',
    '## Last 30 days',
    '',
    '| Day | Page views | Visitors | Downloads | Downloaders | Stars | Forks |',
    '|---|---|---|---|---|---|---|',
    ...recent.map((d) => `| ${d} | ${n(h[d].views)} | ${n(h[d].visitors)} | ${n(h[d].clones)} | ${n(h[d].cloners)} | ${n(h[d].stars)} | ${n(h[d].forks)} |`),
    '',
    '## Where visitors came from (last 14 days)',
    '',
    referrers.length ? '| Site | Views | Visitors |\n|---|---|---|\n' + referrers.map((r) => `| ${r.referrer.replace(/[|<>[\]()]/g, ' ')} | ${r.count} | ${r.uniques} |`).join('\n') : hasTraffic ? 'None yet.' : 'Needs `TRAFFIC_TOKEN`.',
    '',
    `## Forks (${forks.length})`,
    '',
    forks.length ? '| Copy | Created |\n|---|---|\n' + forks.map((f) => `| [${f.name}](${f.url}) | ${f.created.slice(0, 10)} |`).join('\n') : 'None yet.',
    '',
  ].join('\n');
}

async function gh<T>(path: string, token: string | undefined): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`GitHub ${path} answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

async function main() {
  const dir = process.argv[2] ?? 'history';
  const repo = process.env.GITHUB_REPOSITORY ?? 'elikorpus/teamhub-ftc';
  const token = process.env.GH_TOKEN;
  const trafficToken = process.env.TRAFFIC_TOKEN || undefined;
  const today = new Date().toISOString().slice(0, 10);
  mkdirSync(join(dir, 'data'), { recursive: true });
  const file = join(dir, 'data', 'daily.json');
  let history: History = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};

  const info = await gh<{ stargazers_count: number; forks_count: number }>(`/repos/${repo}`, token);
  history[today] = { ...history[today], stars: info.stargazers_count, forks: info.forks_count };

  let referrers: Referrer[] = [];
  if (trafficToken) {
    const views = await gh<{ views: TrafficDay[] }>(`/repos/${repo}/traffic/views?per=day`, trafficToken);
    const clones = await gh<{ clones: TrafficDay[] }>(`/repos/${repo}/traffic/clones?per=day`, trafficToken);
    referrers = await gh<Referrer[]>(`/repos/${repo}/traffic/popular/referrers`, trafficToken);
    history = mergeTraffic(history, views.views, clones.clones);
  }

  const forks: Fork[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await gh<{ full_name: string; html_url: string; created_at: string }[]>(`/repos/${repo}/forks?sort=oldest&per_page=100&page=${page}`, token);
    forks.push(...batch.map((f) => ({ name: f.full_name, url: f.html_url, created: f.created_at })));
    if (batch.length < 100) break;
  }

  writeFileSync(file, JSON.stringify(history, null, 2) + '\n');
  writeFileSync(join(dir, 'data', 'forks.json'), JSON.stringify(forks, null, 2) + '\n');
  writeFileSync(join(dir, 'data', 'referrers.json'), JSON.stringify({ date: today, referrers }, null, 2) + '\n');
  const summary = renderSummary(repo, history, forks, referrers, !!trafficToken, today);
  writeFileSync(join(dir, 'README.md'), summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
