import { useQueries } from '@tanstack/react-query';
import { seasonYear } from '@teamhub/config-schema/util';
import { daysBetween, parseDate } from '@teamhub/ui';
import { getTeamEvents, runtime, useSeason, type FtcTeamEvent } from '@teamhub/sdk';

/** FTCScout event types that are competitions, with how to say them in a sentence. Others (kickoff, workshops) get no greeting. */
const KINDS: Record<string, string> = {
  Scrimmage: 'scrimmage',
  LeagueMeet: 'league meet',
  Qualifier: 'qualifier',
  LeagueTournament: 'league tournament',
  SuperQualifier: 'super qualifier',
  Championship: 'championship',
  Premier: 'premier event',
  FIRSTChampionship: 'World Championship',
  OffSeason: 'off-season event',
};

/** How many days ahead the countdown starts. */
const COUNTDOWN_DAYS = 7;

/**
 * "Competition day", "Qualifier tomorrow" or "3 days to the qualifier" for the soonest competition in the next week,
 * or null when there isn't one.
 */
export function competitionGreeting(events: FtcTeamEvent[], now = new Date()): string | null {
  let best: { days: number; kind: string } | null = null;
  for (const { event } of events) {
    const kind = KINDS[event.type];
    if (!kind || event.finished) continue;
    const start = daysBetween(now, parseDate(event.start));
    const end = daysBetween(now, parseDate(event.end));
    if (end < 0 || start > COUNTDOWN_DAYS) continue;
    const days = Math.max(start, 0);
    if (!best || days < best.days) best = { days, kind };
  }
  if (!best) return null;
  if (best.days === 0) return 'Competition day';
  if (best.days === 1) return `${best.kind[0]!.toUpperCase()}${best.kind.slice(1)} tomorrow`;
  return `${best.days} days to the ${best.kind}`;
}

/** Home greeting hook: the selected team's events, or every team's when viewing all teams. */
export function useCompetitionGreeting(teamId: string | null): string | null {
  const season = seasonYear(useSeason());
  const teams = runtime().config.teams.filter((t) => t.number && (!teamId || t.id === teamId));
  const results = useQueries({
    // Same cache key as useFtcTeamEvents, so the Next event widget and this share one request.
    queries: teams.map((t) => ({ queryKey: ['ftcscout', 'team-events', t.number, season], staleTime: 5 * 60_000, queryFn: () => getTeamEvents(t.number!, season) })),
  });
  return competitionGreeting(results.flatMap((r) => r.data ?? []));
}
