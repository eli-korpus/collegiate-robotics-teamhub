import { useEffect, useState } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Award, CalendarDays, ExternalLink, MapPin, Trophy } from 'lucide-react';
import { seasonYear } from '@teamhub/config-schema/util';
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  ErrorState,
  Segmented,
  Select,
  Sparkline,
  Spinner,
  StatTile,
  StatusPill,
  Textarea,
  cn,
  formatDate,
  toast,
} from '@teamhub/ui';
import {
  awardLabel,
  canWith,
  friendlyError,
  ftcscoutEventUrl,
  getQuickStats,
  matchLabel,
  ModuleHeader,
  runtime,
  Slot,
  useFtcEvent,
  useFtcTeamEvents,
  useMe,
  useSeason,
  useSupabase,
  useTeamScope,
  type FtcMatch,
  type FtcTeamEvent,
} from '@teamhub/sdk';

export function useNumberedTeams() {
  return runtime().config.teams.filter((t) => t.number);
}

export default function EventsRoutes() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path=":season/:code" element={<EventPage />} />
    </Routes>
  );
}

export const Attribution = () => (
  <p className="text-[11.5px] text-faint">
    Data from{' '}
    <a href="https://ftcscout.org" target="_blank" rel="noreferrer" className="hover:underline">
      FTCScout
    </a>
  </p>
);

function Overview() {
  const teams = useNumberedTeams();
  const scope = useTeamScope();
  const label = useSeason();
  const current = seasonYear(label);
  const [season, setSeason] = useState(current);
  const [teamId, setTeamId] = useState<string>(teams.find((t) => t.id === scope)?.id ?? teams[0]?.id ?? '');
  const [view, setView] = useState<'season' | 'compare'>('season');
  const team = teams.find((t) => t.id === teamId);
  if (!teams.length)
    return (
      <div>
        <ModuleHeader moduleId="events" />
        <EmptyState icon={<Trophy />} title="No team numbers yet" body="Add your FTC team number in the setup wizard (Edit > Teams) to see results." />
      </div>
    );
  return (
    <div>
      <ModuleHeader moduleId="events">
        <div className="flex flex-wrap items-center gap-2">
          {teams.length > 1 && (
            <Segmented
              size="sm"
              value={view === 'compare' ? 'compare' : teamId}
              onChange={(v) => (v === 'compare' ? setView('compare') : (setView('season'), setTeamId(v)))}
              options={[...teams.map((t) => ({ value: t.id, label: `${t.name} #${t.number}` })), { value: 'compare', label: 'Compare teams' }]}
            />
          )}
          <Select value={season} onChange={(e) => setSeason(Number(e.target.value))} className="w-36" aria-label="Season">
            {[0, 1, 2, 3].map((d) => (
              <option key={d} value={current - d}>
                {current - d}–{String((current - d + 1) % 100).padStart(2, '0')}
              </option>
            ))}
          </Select>
        </div>
      </ModuleHeader>
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6">
        {view === 'compare' ? <Compare season={season} /> : team && <SeasonTimeline teamNumber={team.number!} season={season} />}
        <Attribution />
      </div>
    </div>
  );
}

export function eventStatus(e: FtcTeamEvent['event']): { label: string; tone: 'success' | 'info' | 'neutral' } {
  if (e.ongoing) return { label: 'Live now', tone: 'success' };
  if (e.finished || new Date(`${e.end}T23:59:59`) < new Date()) return { label: 'Finished', tone: 'neutral' };
  return { label: 'Upcoming', tone: 'info' };
}

function SeasonTimeline({ teamNumber, season }: { teamNumber: number; season: number }) {
  const events = useFtcTeamEvents(teamNumber, season);
  const nav = useNavigate();
  if (events.isLoading) return <Spinner />;
  if (events.error) return <ErrorState error={events.error} retry={() => events.refetch()} title="FTCScout is unavailable" />;
  const list = events.data ?? [];
  const played = list.filter((e) => e.stats);
  const best = played.reduce<number | null>((b, e) => (e.stats?.rank != null && (b == null || e.stats.rank < b) ? e.stats.rank : b), null);
  const wins = played.reduce((s, e) => s + (e.stats?.wins ?? 0), 0);
  const losses = played.reduce((s, e) => s + (e.stats?.losses ?? 0), 0);
  const awards = list.flatMap((e) => e.awards);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Events" value={list.length} />
        <StatTile label="Best rank" value={best ?? '–'} />
        <StatTile label="Qual record" value={`${wins}–${losses}`} />
        <StatTile label="Awards" value={awards.length} icon={<Award />} />
      </div>
      {!list.length ? (
        <EmptyState icon={<CalendarDays />} title="No events this season yet" body="Once your team registers for events they appear here automatically." />
      ) : (
        <ul className="space-y-2">
          {list.map((e) => {
            const st = eventStatus(e.event);
            return (
              <li key={e.eventCode}>
                <button type="button" onClick={() => nav(`/events/${season}/${e.eventCode}`)} className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left shadow-sm hover:shadow-md">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{e.event.name}</p>
                    <p className="text-[12.5px] text-muted">
                      {formatDate(e.event.start, { month: 'short', day: 'numeric' })}
                      {e.event.end !== e.event.start && ` – ${formatDate(e.event.end, { month: 'short', day: 'numeric' })}`} · {[e.event.location?.city, e.event.location?.state].filter(Boolean).join(', ')} · {e.event.type}
                    </p>
                    {e.awards.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {e.awards.map((a) => (
                          <Badge key={a.type + a.placement} tone="warning">
                            <Award className="size-3" /> {awardLabel(a)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {e.stats && (
                    <div className="tabular flex gap-4 text-center text-[12px]">
                      <div>
                        <p className="text-[18px] font-semibold">{e.stats.rank ?? '–'}</p>
                        <p className="text-muted">rank</p>
                      </div>
                      <div>
                        <p className="text-[18px] font-semibold">
                          {e.stats.wins}-{e.stats.losses}
                          {e.stats.ties ? `-${e.stats.ties}` : ''}
                        </p>
                        <p className="text-muted">W-L</p>
                      </div>
                      {e.stats.opr && (
                        <div>
                          <p className="text-[18px] font-semibold">{e.stats.opr.totalPointsNp.toFixed(1)}</p>
                          <p className="text-muted">OPR</p>
                        </div>
                      )}
                    </div>
                  )}
                  <StatusPill label={st.label} tone={st.tone} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Compare({ season }: { season: number }) {
  const teams = useNumberedTeams();
  const qs = useQueries({
    queries: teams.map((t) => ({ queryKey: ['ftcscout', 'quick', t.number, season], staleTime: 10 * 60_000, queryFn: () => getQuickStats(t.number!, season) })),
  });
  const trend = useQueries({
    queries: teams.flatMap((t) => [3, 2, 1, 0].map((d) => ({ queryKey: ['ftcscout', 'quick', t.number, season - d], staleTime: 60 * 60_000, queryFn: () => getQuickStats(t.number!, season - d) }))),
  });
  return (
    <DataTable
      rows={teams.map((t, i) => ({ t, q: qs[i].data, trend: [0, 1, 2, 3].map((j) => trend[i * 4 + j].data?.tot?.value ?? null) }))}
      keyOf={(r) => r.t.id}
      columns={[
        { id: 'team', header: 'Team', cell: (r) => <span className="font-medium">{r.t.name} #{r.t.number}</span> },
        { id: 'opr', header: 'Season OPR', align: 'right', sort: (r) => r.q?.tot?.value ?? -1, cell: (r) => r.q?.tot?.value?.toFixed(1) ?? '–' },
        { id: 'rank', header: 'World OPR rank', align: 'right', sort: (r) => r.q?.tot?.rank ?? 1e9, cell: (r) => r.q?.tot?.rank ?? '–' },
        { id: 'played', header: 'Matches', align: 'right', cell: (r) => r.q?.count ?? '–' },
        { id: 'trend', header: 'OPR over 4 seasons', cell: (r) => <Sparkline values={r.trend.filter((v): v is number => v != null)} width={110} height={26} /> },
      ]}
    />
  );
}

function EventPage() {
  const { season, code } = useParams();
  const nav = useNavigate();
  const teams = useNumberedTeams();
  const s = Number(season);
  const ev = useFtcEvent(s, code, false);
  const [teamNumber, setTeamNumber] = useState(teams[0]?.number ?? 0);
  if (ev.isLoading) return <Spinner className="m-8" />;
  if (ev.error) return <ErrorState error={ev.error} title="FTCScout is unavailable" retry={() => ev.refetch()} />;
  const e = ev.data;
  if (!e) return <EmptyState title="Event not found" action={<Button onClick={() => nav('/events')}>Back</Button>} />;
  const ours = teams.filter((t) => e.teams.some((x) => x.teamNumber === t.number));
  const us = e.teams.find((x) => x.teamNumber === teamNumber);
  const matches = e.matches.filter((m) => m.teams.some((t) => t.teamNumber === teamNumber));
  const ranked = [...e.teams].filter((t) => t.stats?.rank).sort((a, b) => (a.stats!.rank ?? 999) - (b.stats!.rank ?? 999));
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6">
      <button type="button" onClick={() => nav('/events')} className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Events & Results
      </button>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-tight">{e.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <CalendarDays className="size-4" /> {formatDate(e.start, { month: 'long', day: 'numeric', year: 'numeric' })}
            <MapPin className="size-4" /> {[e.location?.venue, e.location?.city, e.location?.state].filter(Boolean).join(', ')}
          </p>
        </div>
        <a href={ftcscoutEventUrl(s, e.code)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
          FTCScout <ExternalLink className="size-3.5" />
        </a>
      </div>
      {ours.length > 1 && (
        <Segmented value={String(teamNumber)} onChange={(v) => setTeamNumber(Number(v))} options={ours.map((t) => ({ value: String(t.number), label: `${t.name} #${t.number}` }))} />
      )}
      {!us ? (
        <Banner tone="info">Team #{teamNumber} isn't registered for this event.</Banner>
      ) : (
        <div className="grid gap-3 sm:grid-cols-4">
          <StatTile label="Rank" value={us.stats?.rank ?? '–'} hint={`of ${e.teams.length}`} />
          <StatTile label="Record" value={us.stats ? `${us.stats.wins}-${us.stats.losses}-${us.stats.ties}` : '–'} />
          <StatTile label="OPR (no penalties)" value={us.stats?.opr?.totalPointsNp.toFixed(1) ?? '–'} />
          <StatTile label="Average score" value={us.stats?.avg?.totalPointsNp.toFixed(1) ?? '–'} />
        </div>
      )}
      {e.awards.filter((a) => a.teamNumber === teamNumber).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {e.awards
            .filter((a) => a.teamNumber === teamNumber)
            .map((a) => (
              <Badge key={a.type + a.placement} tone="warning">
                <Award className="size-3" /> {awardLabel(a)}
              </Badge>
            ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader title="Our matches" />
          <div className="px-4 pb-4">{matches.length ? <MatchTable matches={matches} us={teamNumber} /> : <p className="text-[13px] text-faint">No matches published yet.</p>}</div>
        </Card>
        <div className="space-y-4">
          <EventNotes season={s} code={e.code} teamNumber={teamNumber} />
          <Card>
            <CardHeader title="Rankings" />
            <ol className="max-h-96 relative overflow-y-auto px-4 pb-4 text-[13px]">
              {ranked.map((t) => (
                <li key={t.teamNumber} className={cn('flex items-center gap-2 rounded px-1 py-0.5', t.teamNumber === teamNumber && 'bg-accent-soft font-medium')}>
                  <span className="tabular w-6 text-right text-muted">{t.stats!.rank}</span>
                  <span className="tabular w-14">#{t.teamNumber}</span>
                  <span className="min-w-0 flex-1 truncate">{t.team.name}</span>
                  <span className="tabular text-muted">{t.stats?.opr?.totalPointsNp.toFixed(1)}</span>
                </li>
              ))}
              {!ranked.length && <li className="text-faint">Rankings appear once matches are played.</li>}
            </ol>
          </Card>
        </div>
      </div>
      <Attribution />
    </div>
  );
}

export function MatchTable({ matches, us }: { matches: FtcMatch[]; us: number }) {
  return (
    <table className="w-full text-[12.5px]">
      <thead>
        <tr className="text-left text-muted">
          <th className="py-1 font-medium">Match</th>
          <th className="py-1 font-medium">Red</th>
          <th className="py-1 font-medium">Blue</th>
          <th className="py-1 text-right font-medium">Score</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {matches.map((m) => {
          const ourAlliance = m.teams.find((t) => t.teamNumber === us)?.alliance;
          const red = m.scores?.red?.totalPoints;
          const blue = m.scores?.blue?.totalPoints;
          const won = red != null && blue != null && ((ourAlliance === 'Red' && red > blue) || (ourAlliance === 'Blue' && blue > red));
          const lost = red != null && blue != null && ((ourAlliance === 'Red' && red < blue) || (ourAlliance === 'Blue' && blue < red));
          const side = (a: string) =>
            m.teams
              .filter((t) => t.alliance === a)
              .map((t) => (
                <span key={t.teamNumber} className={cn('mr-1.5 tabular', t.teamNumber === us && 'font-semibold underline')}>
                  {t.teamNumber}
                </span>
              ));
          return (
            <tr key={m.id}>
              <td className="py-1.5 font-medium">{matchLabel(m)}</td>
              <td className="py-1.5 text-red-600 dark:text-red-400">{side('Red')}</td>
              <td className="py-1.5 text-blue-600 dark:text-blue-400">{side('Blue')}</td>
              <td className={cn('tabular py-1.5 text-right', won && 'text-success font-semibold', lost && 'text-danger')}>
                {m.hasBeenPlayed && red != null ? `${red}–${blue}` : m.scheduledStartTime ? new Date(m.scheduledStartTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '–'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function EventNotes({ season, code, teamNumber }: { season: number; code: string; teamNumber: number }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const team = runtime().config.teams.find((t) => t.number === teamNumber);
  const canWrite = !!team && canWith(me, 'events.notes', team.id);
  const q = useQuery({
    queryKey: ['events', 'notes', team?.id, season, code],
    enabled: !!team,
    queryFn: async () => {
      const { data } = await sb.from('evt_notes').select('notes').match({ team_id: team!.id, season, event_code: code }).maybeSingle();
      return data?.notes ?? '';
    },
  });
  const [v, setV] = useState('');
  useEffect(() => setV(q.data ?? ''), [q.data]);
  return (
    <Card>
      <CardHeader title="Team notes" subtitle="Short notes about this event (travel details live on the Calendar event)" />
      <div className="space-y-2 px-4 pb-4">
        <Slot name="events.event.notes" props={{ season, code }} />
        {canWrite ? (
          <>
            <Textarea rows={4} maxLength={5000} value={v} onChange={(e) => setV(e.target.value)} placeholder="What went well, what to fix next time…" />
            <Button
              size="sm"
              disabled={v === (q.data ?? '')}
              onClick={async () => {
                const { error } = await sb.from('evt_notes').upsert({ team_id: team!.id, season, event_code: code, notes: v, updated_by: me.id, updated_at: new Date().toISOString() });
                if (error) return toast.error(friendlyError(error));
                qc.invalidateQueries({ queryKey: ['events', 'notes'] });
                toast.success('Notes saved');
              }}
            >
              Save notes
            </Button>
          </>
        ) : (
          <p className="whitespace-pre-wrap text-[13px] text-muted">{q.data || 'No notes yet.'}</p>
        )}
      </div>
    </Card>
  );
}
