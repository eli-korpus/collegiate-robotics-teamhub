import { useMemo } from 'react';
import { useRows } from '@teamhub/sdk';
import type { FieldDef, FormValues } from '@teamhub/ui';
import type { FtcMatch } from '@teamhub/sdk/ftcscout';
import { compositeScores, fieldAverages, isNumericField } from '../insights';
import type { EventContext } from './event';

export type Kind = 'match' | 'pit';
export interface Template {
  id: string;
  kind: Kind;
  season: string;
  fields: FieldDef[];
  version: number;
}
export interface Entry {
  id: string;
  template_id: string | null;
  template_version: number;
  kind: Kind;
  season: string;
  event_code: string;
  match_label: string | null;
  team_number: number;
  data: FormValues;
  scout: string | null;
  created_at: string;
}

export const useTemplates = (season: string) => useRows<Template>(['scouting', 'templates', season], (sb) => sb.from('sct_templates').select('*').eq('season', season));
export const useEntries = (event: string | null) =>
  useRows<Entry>(['scouting', 'entries', event], (sb) => sb.from('sct_entries').select('*').eq('event_code', event ?? '').order('created_at'), { enabled: !!event, refetchInterval: 60_000 });

/** Per-team scouting averages, event averages and the data-driven pick score — recomputed as data arrives. */
export function useScoutingStats(ctx: EventContext, templates: Template[]) {
  const entries = useEntries(ctx.code);
  const fields = (templates.find((t) => t.kind === 'match')?.fields ?? []).filter(isNumericField);
  return useMemo(() => {
    const match = (entries.data ?? []).filter((e) => e.kind === 'match');
    const byTeam = new Map<number, Entry[]>();
    for (const e of entries.data ?? []) byTeam.set(e.team_number, [...(byTeam.get(e.team_number) ?? []), e]);
    const teamAvg = new Map<number, Record<string, number>>();
    for (const t of new Set([...ctx.teams.map((x) => x.number), ...byTeam.keys()])) teamAvg.set(t, fieldAverages(fields, (byTeam.get(t) ?? []).filter((e) => e.kind === 'match').map((e) => e.data)));
    const eventAvg = fieldAverages(fields, match.map((e) => e.data));
    const composite = compositeScores(
      [...teamAvg.entries()].map(([team, f]) => ({ team, opr: ctx.teams.find((x) => x.number === team)?.stats?.opr?.totalPointsNp ?? null, fields: f })),
      fields.map((f) => f.id),
    );
    const scoutedCounts = new Map([...byTeam.entries()].map(([t, es]) => [t, es.filter((e) => e.kind === 'match').length]));
    return { entries: entries.data ?? [], byTeam, teamAvg, eventAvg, composite, scoutedCounts, fields, loading: entries.isLoading };
  }, [entries.data, ctx.teams, fields]);
}

/** Estimated start: scheduled time shifted by how late the field is running (from the last played match). */
export function estimateStart(m: FtcMatch, all: FtcMatch[]): Date | null {
  if (!m.scheduledStartTime) return null;
  const played = all.filter((x) => x.hasBeenPlayed && x.actualStartTime && x.scheduledStartTime).sort((a, b) => b.id - a.id)[0];
  const delay = played ? new Date(played.actualStartTime!).getTime() - new Date(played.scheduledStartTime!).getTime() : 0;
  return new Date(new Date(m.scheduledStartTime).getTime() + Math.max(0, delay));
}
