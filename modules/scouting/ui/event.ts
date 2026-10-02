/**
 * Everything about the event being scouted, kept live: FTCScout event (rankings, schedule, results, awards) polled
 * every 60 s while it's happening and the page is visible, merged with manually-entered events and season summaries.
 */
import { useQuery } from '@tanstack/react-query';
import { seasonYear } from '@teamhub/config-schema/util';
import { getEvent, getTeamsSummary, runtime, usePageVisible, useRows, useSeason, type FtcEventDetail, type FtcStats, type TeamSeasonSummary } from '@teamhub/sdk';
import { toDateInput } from '@teamhub/ui';

export interface ManualEvent {
  season: string;
  code: string;
  name: string;
  start_date: string | null;
  teams: number[];
}

export interface EventTeam {
  number: number;
  name: string | null;
  city: string | null;
  stats: FtcStats | null;
  season: TeamSeasonSummary['quick'];
}

export function useManualEvents() {
  const season = useSeason();
  return useRows<ManualEvent>(['scouting', 'manual-events', season], (sb) => sb.from('sct_events').select('*').eq('season', season).order('start_date', { ascending: false }));
}

export function isLiveDay(e: Pick<FtcEventDetail, 'start' | 'end' | 'ongoing'> | null | undefined): boolean {
  if (!e) return false;
  const today = toDateInput(new Date());
  return !!e.ongoing || (e.start <= today && today <= e.end);
}

export function useEventContext(code: string | null) {
  const label = useSeason();
  const season = seasonYear(label);
  const visible = usePageVisible();
  const manual = useManualEvents();
  const man = manual.data?.find((e) => e.code.toUpperCase() === code?.toUpperCase()) ?? null;
  const ftc = useQuery({
    queryKey: ['ftcscout', 'event', season, code],
    enabled: !!code,
    retry: false,
    staleTime: 30_000,
    queryFn: () => getEvent(season, code!),
    // Live during the event while the page is visible; otherwise refresh occasionally.
    refetchInterval: (q) => (visible ? (isLiveDay(q.state.data as FtcEventDetail | null) ? 60_000 : 10 * 60_000) : false),
    refetchIntervalInBackground: false,
  });
  const numbers = [...new Set([...(ftc.data?.teams.map((t) => t.teamNumber) ?? []), ...(man?.teams ?? [])])].sort((a, b) => a - b);
  const summaries = useQuery({
    queryKey: ['ftcscout', 'summaries', season, numbers.join(',')],
    enabled: numbers.length > 0,
    staleTime: 30 * 60_000,
    retry: false,
    queryFn: () => getTeamsSummary(numbers, season),
  });
  const teams: EventTeam[] = numbers.map((n) => {
    const t = ftc.data?.teams.find((x) => x.teamNumber === n);
    const s = summaries.data?.get(n);
    return { number: n, name: t?.team.name ?? s?.name ?? null, city: s?.city ?? null, stats: t?.stats ?? null, season: s?.quick ?? null };
  });
  const ours = runtime().config.teams.map((t) => t.number).filter((n): n is number => !!n && numbers.includes(n));
  return {
    code,
    season,
    name: ftc.data?.name ?? man?.name ?? code ?? '',
    event: ftc.data ?? null,
    manual: man,
    source: ftc.data ? (man ? 'both' : 'ftcscout') : man ? 'manual' : 'none',
    teams,
    matches: ftc.data?.matches ?? [],
    awards: ftc.data?.awards ?? [],
    ours,
    live: isLiveDay(ftc.data) && visible,
    updatedAt: ftc.dataUpdatedAt,
    loading: ftc.isLoading || manual.isLoading,
    ftcError: ftc.error,
    refresh: () => ftc.refetch(),
  };
}
export type EventContext = ReturnType<typeof useEventContext>;
