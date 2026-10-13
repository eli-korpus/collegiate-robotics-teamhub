import { runtime, useFtcEvent, usePageVisible, useRows, useTeamScope, useViewableTeams, type FtcMatch } from '@teamhub/sdk';

export interface Active {
  team_id: string;
  event_code: string;
  season: number;
  pit_notes: string;
  updated_by: string | null;
  started_at: string;
  updated_at: string;
}

export function useOurTeam() {
  const scope = useTeamScope();
  const active = useActive();
  const teams = runtime().config.teams.filter((t) => t.number);
  const mine = useViewableTeams().filter((t) => t.number);
  // The sidebar's team; when viewing all, the first of your teams that's at an event (then your first team).
  return teams.find((t) => t.id === scope) ?? mine.find((t) => active.data?.some((a) => a.team_id === t.id)) ?? mine[0] ?? teams[0] ?? null;
}

export const useActive = () => useRows<Active>(['competition-day', 'active'], (sb) => sb.from('comp_active').select('*'));

/** Scheduled time shifted by how late the field is running (labeled as an estimate everywhere). */
export function estimate(m: FtcMatch, all: FtcMatch[]): Date | null {
  if (!m.scheduledStartTime) return null;
  const last = all.filter((x) => x.hasBeenPlayed && x.actualStartTime && x.scheduledStartTime).sort((a, b) => b.id - a.id)[0];
  const delay = last ? new Date(last.actualStartTime!).getTime() - new Date(last.scheduledStartTime!).getTime() : 0;
  return new Date(new Date(m.scheduledStartTime).getTime() + Math.max(0, delay));
}

export function useLiveEvent(active: Active | undefined) {
  const visible = usePageVisible();
  // Poll FTCScout every 60 s, only while this screen is visible (spec §13.20).
  return useFtcEvent(active?.season ?? 0, active?.event_code, true, visible && !!active);
}
