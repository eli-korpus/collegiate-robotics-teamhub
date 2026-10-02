import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { History, MapPin, RefreshCw, Timer, Trash2, Trophy } from 'lucide-react';
import { seasonYear } from '@teamhub/config-schema/util';
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  EmptyState,
  IconButton,
  RelativeTime,
  Segmented,
  Select,
  Spinner,
  StatTile,
  Textarea,
  VisibilityNote,
  cn,
  formatDate,
  formatTime,
  relativeTime,
  toast,
  useConfirm,
} from '@teamhub/ui';
import {
  awardLabel,
  canWith,
  friendlyError,
  getTeamEvents,
  isMultiTeam,
  matchLabel,
  ModuleHeader,
  runtime,
  Slot,
  useFtcEvent,
  useMe,
  usePageVisible,
  useRealtime,
  useRows,
  useSeason,
  useSupabase,
  useTeamScope,
  type FtcMatch,
} from '@teamhub/sdk';

export interface Active {
  team_id: string;
  event_code: string;
  season: number;
  pit_notes: string;
  updated_by: string | null;
  started_at: string;
  updated_at: string;
}
interface HistoryRow {
  id: string;
  team_id: string;
  season: number;
  event_code: string;
  pit_notes: string;
  started_at: string;
  ended_at: string;
}

export function useOurTeam() {
  const scope = useTeamScope();
  const teams = runtime().config.teams.filter((t) => t.number);
  return teams.find((t) => t.id === scope) ?? teams[0] ?? null;
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

export default function CompetitionDayRoutes() {
  const team = useOurTeam();
  const active = useActive();
  const qc = useQueryClient();
  const [view, setView] = useState<'live' | 'history'>('live');
  useRealtime('comp_active', null, () => qc.invalidateQueries({ queryKey: ['competition-day', 'active'] }));
  if (!team)
    return (
      <div>
        <ModuleHeader moduleId="competition-day" />
        <EmptyState icon={<Timer />} title="Add your team number first" body="Competition Day uses your FTC team number to follow your matches. An admin can add it in the setup wizard." />
      </div>
    );
  const a = active.data?.find((x) => x.team_id === team.id);
  return (
    <div>
      <ModuleHeader moduleId="competition-day" subtitle={isMultiTeam() ? `${team.name} #${team.number}` : undefined}>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'live', label: 'Live' },
              { value: 'history', label: 'Past events', icon: <History className="size-3.5" /> },
            ]}
          />
          <EventChooser teamId={team.id} teamNumber={team.number!} active={a} />
          <Slot name="competition-day.shortcuts" props={{ teamId: team.id, eventCode: a?.event_code }} />
        </div>
      </ModuleHeader>
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        {active.isLoading ? <Spinner /> : view === 'history' ? <PastEvents teamId={team.id} teamNumber={team.number!} /> : a ? <Live active={a} teamNumber={team.number!} /> : <EmptyState icon={<Timer />} title="No event selected" body="Choose the event your team is at right now." />}
      </div>
    </div>
  );
}

function EventChooser({ teamId, teamNumber, active }: { teamId: string; teamNumber: number; active?: Active }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const season = seasonYear(useSeason());
  const events = useQuery({ queryKey: ['ftcscout', 'team-events', teamNumber, season], staleTime: 10 * 60_000, queryFn: () => getTeamEvents(teamNumber, season) });
  if (!canWith(me, 'competition-day.set_event', teamId)) return active ? <Badge>{active.event_code}</Badge> : null;
  return (
    <Select
      value={active?.event_code ?? ''}
      className="w-72"
      aria-label="Active event"
      onChange={async (e) => {
        const code = e.target.value;
        const res = code
          ? await sb.from('comp_active').upsert({ team_id: teamId, event_code: code, season, updated_by: me.id, updated_at: new Date().toISOString() })
          : await sb.from('comp_active').delete().eq('team_id', teamId);
        if (res.error) return toast.error(friendlyError(res.error));
        qc.invalidateQueries({ queryKey: ['competition-day'] });
      }}
    >
      <option value="">{events.isLoading ? 'Loading events…' : 'Choose the event we’re at…'}</option>
      {(events.data ?? []).map((ev) => (
        <option key={ev.eventCode} value={ev.eventCode}>
          {ev.event.name} · {formatDate(ev.event.start)}
        </option>
      ))}
      {active && !(events.data ?? []).some((x) => x.eventCode === active.event_code) && <option value={active.event_code}>{active.event_code}</option>}
    </Select>
  );
}

function Countdown({ to }: { to: Date }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 15_000);
    return () => clearInterval(t);
  }, []);
  const mins = Math.round((to.getTime() - Date.now()) / 60_000);
  return <>{mins <= 0 ? 'any minute now' : mins < 60 ? `in ~${mins} min` : `~${formatTime(to)}`}</>;
}

function Live({ active, teamNumber }: { active: Active; teamNumber: number }) {
  const ev = useLiveEvent(active);
  const e = ev.data;
  if (ev.isLoading) return <Spinner />;
  if (!e) return <Banner tone="warning" title="FTCScout doesn't have this event yet">Results, schedule and rankings appear here as soon as they're published. Pit notes work now.<PitNotes active={active} /></Banner>;
  const ours = e.matches.filter((m) => m.teams.some((t) => t.teamNumber === teamNumber)).sort((a, b) => a.id - b.id);
  const next = ours.find((m) => !m.hasBeenPlayed);
  const us = e.teams.find((t) => t.teamNumber === teamNumber);
  const stat = (n: number) => e.teams.find((t) => t.teamNumber === n);
  const ranked = [...e.teams].filter((t) => t.stats?.rank).sort((a, b) => a.stats!.rank! - b.stats!.rank!);
  const myIdx = ranked.findIndex((t) => t.teamNumber === teamNumber);
  const around = myIdx >= 0 ? ranked.slice(Math.max(0, myIdx - 2), myIdx + 3) : ranked.slice(0, 5);
  const ourAlliance = next?.teams.find((t) => t.teamNumber === teamNumber)?.alliance;
  const est = next ? estimate(next, e.matches) : null;
  const awards = e.awards.filter((a) => a.teamNumber === teamNumber);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
        <span className="text-[15px] font-semibold text-fg">{e.name}</span>
        <MapPin className="size-3.5" /> {[e.location?.venue, e.location?.city].filter(Boolean).join(', ')}
        <span className="flex-1" />
        {ev.dataUpdatedAt > 0 && <span>updated {relativeTime(new Date(ev.dataUpdatedAt))}</span>}
        <Button size="sm" variant="ghost" icon={<RefreshCw className="size-3.5" />} onClick={() => ev.refetch()}>
          Refresh
        </Button>
      </div>
      {next ? (
        <Card className={cn('p-4', ourAlliance === 'Red' ? 'border-red-500/50' : 'border-blue-500/50')}>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">Next match</p>
              <p className="text-[32px] font-bold leading-none">{matchLabel(next)}</p>
              <p className="mt-1 text-[13px] text-muted">
                {est ? <Countdown to={est} /> : 'Time not published'} {est && <Badge>estimate</Badge>} · we're <strong className={ourAlliance === 'Red' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}>{ourAlliance}</strong>
              </p>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3 text-[13px]">
              {(['Red', 'Blue'] as const).map((side) => (
                <div key={side} className={cn('rounded-md p-2', side === 'Red' ? 'bg-red-500/10' : 'bg-blue-500/10')}>
                  <p className="mb-1 text-[11.5px] font-semibold uppercase">{side === ourAlliance ? 'With us' : 'Against us'}</p>
                  {next.teams
                    .filter((t) => t.alliance === side)
                    .map((t) => {
                      const s = stat(t.teamNumber);
                      return (
                        <p key={t.teamNumber} className={cn(t.teamNumber === teamNumber && 'font-semibold')}>
                          {t.teamNumber} <span className="text-muted">{s?.team.name}</span>
                          <span className="block text-[11.5px] text-faint">
                            {s?.stats?.rank ? `rank ${s.stats.rank} · ` : ''}
                            {s?.stats?.opr ? `OPR ${s.stats.opr.totalPointsNp.toFixed(1)}` : 'no matches yet'}
                          </span>
                        </p>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
          <Slot name="competition-day.match" props={{ match: next, eventCode: active.event_code }} wrap={(c) => <div className="mt-3 flex flex-wrap gap-2">{c}</div>} />
        </Card>
      ) : (
        <Banner tone="success" title={ours.length ? 'No more scheduled matches for us' : 'Our schedule isn’t published yet'}>
          {ours.length ? 'Watch for alliance selection and elimination matches — they appear here automatically.' : 'It appears here as soon as the event publishes it.'}
        </Banner>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Our rank" value={us?.stats?.rank ?? '—'} hint={`of ${e.teams.length}`} />
        <StatTile label="Record" value={us?.stats ? `${us.stats.wins}-${us.stats.losses}-${us.stats.ties}` : '—'} />
        <StatTile label="Ranking points" value={us?.stats?.rp?.toFixed(2) ?? '—'} />
        <StatTile label="OPR" value={us?.stats?.opr?.totalPointsNp.toFixed(1) ?? '—'} />
      </div>
      {awards.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {awards.map((a) => (
            <Badge key={a.type + a.placement} tone="warning">
              <Trophy className="size-3" /> {awardLabel(a)}
            </Badge>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader title="Our matches" />
          <ul className="divide-y divide-border px-4 pb-2 text-[13px]">
            {ours.map((m) => {
              const side = m.teams.find((t) => t.teamNumber === teamNumber)!.alliance === 'Blue' ? 'blue' : 'red';
              const other = side === 'red' ? 'blue' : 'red';
              const s = m.scores?.[side]?.totalPoints;
              const o = m.scores?.[other]?.totalPoints;
              const est2 = !m.hasBeenPlayed ? estimate(m, e.matches) : null;
              return (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  <span className="w-12 font-semibold">{matchLabel(m)}</span>
                  <span className="flex-1 text-muted">
                    with {m.teams.filter((t) => t.alliance === m.teams.find((x) => x.teamNumber === teamNumber)!.alliance && t.teamNumber !== teamNumber).map((t) => t.teamNumber).join(', ')}
                  </span>
                  {m.hasBeenPlayed && s != null ? (
                    <span className={cn('tabular font-semibold', s > o! ? 'text-success' : s < o! ? 'text-danger' : '')}>
                      {s}–{o} {s > o! ? 'W' : s < o! ? 'L' : 'T'}
                    </span>
                  ) : (
                    <span className="text-[12px] text-faint">{est2 ? `~${formatTime(est2)} (est.)` : 'scheduled'}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
        <div className="space-y-4">
          <PitNotes active={active} />
          <Card>
            <CardHeader title="Rankings around us" />
            <ol className="space-y-0.5 px-4 pb-4 text-[13px]">
              {around.map((t) => (
                <li key={t.teamNumber} className={cn('flex gap-2 rounded px-1 py-0.5', t.teamNumber === teamNumber && 'bg-accent-soft font-semibold')}>
                  <span className="tabular w-6 text-right text-muted">{t.stats!.rank}</span>
                  <span className="flex-1 truncate">
                    {t.teamNumber} {t.team.name}
                  </span>
                  <span className="tabular text-muted">{t.stats!.rp?.toFixed(2)} RP</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
      <p className="text-[11.5px] text-faint">Live from FTCScout, refreshing every minute while this screen is open. Times are estimates.</p>
    </div>
  );
}

function PitNotes({ active }: { active: Active }) {
  const sb = useSupabase();
  const me = useMe();
  const [v, setV] = useState(active.pit_notes);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setV(active.pit_notes);
  }, [active.pit_notes]);
  const can = canWith(me, 'competition-day.edit_pit_notes', active.team_id);
  return (
    <Card>
      <CardHeader title="Pit notes" subtitle={active.updated_at ? <>Updated <RelativeTime date={active.updated_at} /></> : undefined} />
      <div className="space-y-1.5 px-4 pb-4">
        <Textarea
          rows={4}
          maxLength={2000}
          disabled={!can}
          value={v}
          placeholder="e.g. Intake servo replaced — test before Q14"
          onFocus={() => (editing.current = true)}
          onChange={(e) => setV(e.target.value)}
          onBlur={async () => {
            editing.current = false;
            if (v === active.pit_notes) return;
            const { error } = await sb.rpc('comp_set_notes', { p_team: active.team_id, p_notes: v });
            if (error) toast.error(friendlyError(error));
          }}
        />
        <VisibilityNote>Short status for the team, synced live. Saved with this event in Past events.</VisibilityNote>
      </div>
    </Card>
  );
}

function PastEvents({ teamId, teamNumber }: { teamId: string; teamNumber: number }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const hist = useRows<HistoryRow>(['competition-day', 'history', teamId], (s) => s.from('comp_history').select('*').eq('team_id', teamId).order('ended_at', { ascending: false }));
  const seasons = [...new Set((hist.data ?? []).map((h) => h.season))];
  const results = useQuery({
    queryKey: ['ftcscout', 'history', teamNumber, seasons.join(',')],
    enabled: seasons.length > 0,
    staleTime: 60 * 60_000,
    queryFn: async () => (await Promise.all(seasons.map((s) => getTeamEvents(teamNumber, s).catch(() => [])))).flat(),
  });
  if (hist.isLoading) return <Spinner />;
  if (!hist.data?.length) return <EmptyState icon={<History />} title="No past events yet" body="When your team moves on to its next event, the last one — with its pit notes and final results — is kept here." />;
  return (
    <ul className="space-y-3">
      {hist.data.map((h) => {
        const r = results.data?.find((x) => x.eventCode === h.event_code);
        return (
          <li key={h.id}>
            <Card className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r?.event.name ?? h.event_code}</p>
                  <p className="text-[12.5px] text-muted">
                    {formatDate(h.started_at, { month: 'short', day: 'numeric', year: 'numeric' })} · season {h.season}
                  </p>
                </div>
                {r?.stats && (
                  <div className="tabular flex gap-3 text-center text-[12px]">
                    <div>
                      <p className="text-[16px] font-semibold">{r.stats.rank ?? '—'}</p>
                      <p className="text-muted">rank</p>
                    </div>
                    <div>
                      <p className="text-[16px] font-semibold">
                        {r.stats.wins}-{r.stats.losses}-{r.stats.ties}
                      </p>
                      <p className="text-muted">record</p>
                    </div>
                  </div>
                )}
                {me.isAdmin && (
                  <IconButton
                    label="Delete this past event"
                    size="sm"
                    onClick={async () => {
                      if (!(await confirm({ title: 'Delete this past event?', body: 'Its pit notes are deleted. Scouting data is managed separately in Scouting.', danger: true, confirmLabel: 'Delete' }))) return;
                      const { error } = await sb.from('comp_history').delete().eq('id', h.id);
                      if (error) return toast.error(friendlyError(error));
                      qc.invalidateQueries({ queryKey: ['competition-day', 'history'] });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                )}
              </div>
              {r?.awards.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.awards.map((a) => (
                    <Badge key={a.type + a.placement} tone="warning">
                      <Trophy className="size-3" /> {awardLabel(a)}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {h.pit_notes && <p className="mt-2 whitespace-pre-wrap rounded-md bg-bg-subtle p-2 text-[13px]">{h.pit_notes}</p>}
            </Card>
          </li>
        );
      })}
      {!me.isAdmin && <p className="text-[11.5px] text-faint">Past events are kept. Only admins can delete them.</p>}
    </ul>
  );
}
