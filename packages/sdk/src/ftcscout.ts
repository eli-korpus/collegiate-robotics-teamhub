/**
 * Typed FTCScout client (spec §14.1). No key needed; CORS allowed.
 * Season-agnostic: season-specific GraphQL union members (TeamEventStats2025, MatchScores2025 …) are discovered by
 * introspection at runtime, and only fields common to every season (rank, wins, totalPointsNp …) are requested.
 */
import { useQuery } from '@tanstack/react-query';

export const FTCSCOUT_API = 'https://api.ftcscout.org/graphql';
export const ftcscoutTeamUrl = (n: number) => `https://ftcscout.org/teams/${n}`;
export const ftcscoutEventUrl = (season: number, code: string) => `https://ftcscout.org/events/${season}/${code}`;

export class FtcScoutError extends Error {}

const inflight = new Map<string, Promise<unknown>>();

export async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const key = query + JSON.stringify(variables);
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = (async () => {
    let res: Response;
    try {
      res = await fetch(FTCSCOUT_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      throw new FtcScoutError('FTCScout is unavailable. Try again later.');
    }
    if (!res.ok) throw new FtcScoutError(`FTCScout is unavailable (HTTP ${res.status}). Try again later.`);
    const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (body.errors?.length && !body.data) throw new FtcScoutError(body.errors[0].message);
    return body.data as T;
  })();
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

const unionCache = new Map<string, Promise<string[]>>();
async function unionMembers(name: string): Promise<string[]> {
  let p = unionCache.get(name);
  if (!p) {
    p = gql<{ __type: { possibleTypes: { name: string }[] } | null }>(`query($n: String!) { __type(name: $n) { possibleTypes { name } } }`, { n: name }).then(
      (d) => d.__type?.possibleTypes.map((t) => t.name) ?? [],
    );
    unionCache.set(name, p);
  }
  return p;
}

/** e.g. TeamEventStats + 2025 → "TeamEventStats2025" (or "…2021Trad"). */
async function seasonMember(union: string, season: number): Promise<string | null> {
  const all = await unionMembers(union);
  return all.find((t) => t === `${union}${season}`) ?? all.find((t) => t === `${union}${season}Trad`) ?? null;
}

async function statsFragment(season: number): Promise<string> {
  const t = await seasonMember('TeamEventStats', season);
  return t ? `... on ${t} { rank rp wins losses ties qualMatchesPlayed opr { totalPointsNp } avg { totalPointsNp } }` : '__typename';
}
async function scoresFragment(season: number): Promise<string> {
  const t = await seasonMember('MatchScores', season);
  return t ? `... on ${t} { red { totalPoints totalPointsNp } blue { totalPoints totalPointsNp } }` : '__typename';
}

export interface FtcLocation {
  venue: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}
export interface FtcTeam {
  number: number;
  name: string;
  schoolName: string | null;
  rookieYear: number | null;
  website: string | null;
  location: FtcLocation | null;
}
export interface FtcStats {
  rank: number | null;
  rp: number | null;
  wins: number;
  losses: number;
  ties: number;
  qualMatchesPlayed: number;
  opr: { totalPointsNp: number } | null;
  avg: { totalPointsNp: number } | null;
}
export interface FtcAward {
  type: string;
  placement: number;
  teamNumber?: number;
}
export interface FtcEventSummary {
  code: string;
  name: string;
  start: string;
  end: string;
  type: string;
  timezone: string | null;
  location: FtcLocation | null;
  finished?: boolean;
  ongoing?: boolean;
}
export interface FtcTeamEvent {
  eventCode: string;
  event: FtcEventSummary;
  stats: FtcStats | null;
  awards: FtcAward[];
}
export interface FtcMatchTeam {
  teamNumber: number;
  alliance: 'Red' | 'Blue' | 'Solo';
  station: string;
  surrogate?: boolean;
}
export interface FtcMatch {
  id: number;
  matchNum: number;
  series: number;
  tournamentLevel: 'Quals' | 'Semis' | 'Finals' | 'DoubleElim';
  description: string | null;
  hasBeenPlayed: boolean;
  scheduledStartTime: string | null;
  actualStartTime: string | null;
  teams: FtcMatchTeam[];
  scores: { red?: { totalPoints: number; totalPointsNp: number }; blue?: { totalPoints: number; totalPointsNp: number } } | null;
}
export interface FtcEventDetail extends FtcEventSummary {
  teams: { teamNumber: number; team: { name: string }; stats: FtcStats | null }[];
  matches: FtcMatch[];
  awards: FtcAward[];
}

const LOC = 'location { venue city state country }';
const EVENT = `code name start end type timezone finished ongoing ${LOC}`;

export async function getTeam(number: number): Promise<FtcTeam | null> {
  const d = await gql<{ teamByNumber: FtcTeam | null }>(
    `query($n: Int!) { teamByNumber(number: $n) { number name schoolName rookieYear website ${LOC} } }`,
    { n: number },
  );
  return d.teamByNumber;
}

export async function getTeamEvents(number: number, season: number): Promise<FtcTeamEvent[]> {
  const sf = await statsFragment(season);
  const d = await gql<{ teamByNumber: { events: FtcTeamEvent[] } | null }>(
    `query($n: Int!, $s: Int!) { teamByNumber(number: $n) { events(season: $s) { eventCode event { ${EVENT} } stats { ${sf} } awards { type placement } } } }`,
    { n: number, s: season },
  );
  return (d.teamByNumber?.events ?? []).sort((a, b) => a.event.start.localeCompare(b.event.start));
}

export async function getEvent(season: number, code: string): Promise<FtcEventDetail | null> {
  const [sf, mf] = await Promise.all([statsFragment(season), scoresFragment(season)]);
  const d = await gql<{ eventByCode: FtcEventDetail | null }>(
    `query($s: Int!, $c: String!) { eventByCode(season: $s, code: $c) { ${EVENT}
      teams { teamNumber team { name } stats { ${sf} } }
      matches { id matchNum series tournamentLevel description hasBeenPlayed scheduledStartTime actualStartTime
        teams { teamNumber alliance station surrogate } scores { ${mf} } }
      awards { type placement teamNumber } } }`,
    { s: season, c: code },
  );
  return d.eventByCode;
}

export async function searchEvents(season: number, searchText: string): Promise<FtcEventSummary[]> {
  const d = await gql<{ eventsSearch: FtcEventSummary[] }>(
    `query($s: Int!, $q: String) { eventsSearch(season: $s, searchText: $q, limit: 20) { ${EVENT} } }`,
    { s: season, q: searchText || null },
  );
  return d.eventsSearch;
}

export async function getQuickStats(number: number, season: number) {
  const d = await gql<{ teamByNumber: { quickStats: { tot: { value: number; rank: number } | null; count: number } | null } | null }>(
    `query($n: Int!, $s: Int!) { teamByNumber(number: $n) { quickStats(season: $s) { tot { value rank } count } } }`,
    { n: number, s: season },
  );
  return d.teamByNumber?.quickStats ?? null;
}

export interface TeamSeasonSummary {
  number: number;
  name: string | null;
  city: string | null;
  rookieYear: number | null;
  quick: { tot: { value: number; rank: number } | null; count: number } | null;
}

/** Names + season quick stats (world OPR rank) for many teams in ONE request (GraphQL aliases, 40 per batch). */
export async function getTeamsSummary(numbers: number[], season: number): Promise<Map<number, TeamSeasonSummary>> {
  const out = new Map<number, TeamSeasonSummary>();
  const uniq = [...new Set(numbers.filter((n) => Number.isInteger(n) && n > 0))];
  for (let i = 0; i < uniq.length; i += 40) {
    const chunk = uniq.slice(i, i + 40);
    const fields = chunk.map((n) => `t${n}: teamByNumber(number: ${n}) { number name rookieYear location { city state } quickStats(season: ${season}) { tot { value rank } count } }`).join("\n");
    const d = await gql<Record<string, { number: number; name: string; rookieYear: number | null; location: FtcLocation | null; quickStats: TeamSeasonSummary['quick'] } | null>>(`{ ${fields} }`);
    for (const n of chunk) {
      const t = d[`t${n}`];
      out.set(n, { number: n, name: t?.name ?? null, city: [t?.location?.city, t?.location?.state].filter(Boolean).join(', ') || null, rookieYear: t?.rookieYear ?? null, quick: t?.quickStats ?? null });
    }
  }
  return out;
}

const AWARD_NAMES: Record<string, string> = {
  DeansListFinalist: "Dean's List Finalist",
  DeansListSemiFinalist: "Dean's List Semi-Finalist",
  DeansListWinner: "Dean's List Winner",
  JudgesChoice: "Judges' Choice",
  TopRanked: 'Top Ranked',
};
export function awardLabel(a: FtcAward): string {
  const name = AWARD_NAMES[a.type] ?? a.type.replace(/([a-z])([A-Z])/g, '$1 $2');
  const generic = ['Winner', 'Finalist', 'DivisionWinner', 'DivisionFinalist', 'ConferenceFinalist'].includes(a.type);
  return generic || a.placement <= 1 ? (a.placement > 1 ? `${name} (#${a.placement})` : name) : `${name} ${ordinal(a.placement)} place`;
}
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function matchLabel(m: Pick<FtcMatch, 'tournamentLevel' | 'matchNum' | 'series' | 'description'>): string {
  if (m.tournamentLevel === 'Quals') return `Q${m.matchNum}`;
  if (m.tournamentLevel === 'Finals') return `F${m.matchNum}`;
  return m.description || `${m.tournamentLevel} ${m.series}-${m.matchNum}`;
}

// ── React hooks (TanStack Query caching, spec §14.1) ───────────────────────
export function useFtcTeam(number: number | null | undefined) {
  return useQuery({ queryKey: ['ftcscout', 'team', number], enabled: !!number, staleTime: 60 * 60_000, queryFn: () => getTeam(number!) });
}
export function useFtcTeamEvents(number: number | null | undefined, season: number) {
  return useQuery({ queryKey: ['ftcscout', 'team-events', number, season], enabled: !!number, staleTime: 5 * 60_000, queryFn: () => getTeamEvents(number!, season) });
}
export function useFtcEvent(season: number, code: string | null | undefined, live = false, enabled = true) {
  return useQuery({
    queryKey: ['ftcscout', 'event', season, code],
    enabled: !!code && enabled,
    staleTime: live ? 60_000 : 5 * 60_000,
    refetchInterval: live && enabled ? 60_000 : false,
    refetchIntervalInBackground: false,
    queryFn: () => getEvent(season, code!),
  });
}
