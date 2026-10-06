import { useEffect, useState } from 'react';
import { Award, RefreshCw } from 'lucide-react';
import { Badge, Banner, Button, DataTable, EmptyState, Segmented, Select, StatusPill, cn, formatTime, relativeTime } from '@teamhub/ui';
import { awardLabel, matchLabel, type FtcMatch } from '@teamhub/sdk';
import type { EventContext } from './event';
import { estimateStart, type useScoutingStats } from './stats';

export function LiveBadge({ ctx }: { ctx: EventContext }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 10_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-muted">
      {ctx.live && (
        <span className="inline-flex items-center gap-1 font-medium text-success">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          Live
        </span>
      )}
      {ctx.updatedAt > 0 && <span>updated {relativeTime(new Date(ctx.updatedAt))}</span>}
      {ctx.event && (
        <Button size="sm" variant="ghost" icon={<RefreshCw className="size-3.5" />} onClick={ctx.refresh} aria-label="Refresh from FTCScout">
          Refresh
        </Button>
      )}
    </span>
  );
}

/** Rankings, schedule/results and awards: everything you'd otherwise look up on the FTC website. */
export function EventView({ ctx, stats, onTeam }: { ctx: EventContext; stats: ReturnType<typeof useScoutingStats>; onTeam: (n: number) => void }) {
  const [view, setView] = useState<'rankings' | 'matches' | 'awards'>('rankings');
  const [filter, setFilter] = useState<string>(ctx.ours[0] ? String(ctx.ours[0]) : 'all');
  if (!ctx.event)
    return ctx.source === 'manual' ? (
      <Banner tone="info" title="This event isn't on FTCScout">Rankings and match results appear here automatically if it gets published there. Scouting and insights work either way.</Banner>
    ) : (
      <EmptyState title="No event data yet" body="FTCScout hasn't published this event. Check the code, or add the event manually." />
    );
  const e = ctx.event;
  const rows = [...ctx.teams].sort((a, b) => (a.stats?.rank ?? 999) - (b.stats?.rank ?? 999) || a.number - b.number);
  const matches = filter === 'all' ? e.matches : e.matches.filter((m) => m.teams.some((t) => t.teamNumber === Number(filter)));
  const sorted = [...matches].sort((a, b) => Number(a.hasBeenPlayed) - Number(b.hasBeenPlayed) || (a.hasBeenPlayed ? b.id - a.id : a.id - b.id));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'rankings', label: 'Rankings' },
            { value: 'matches', label: `Matches (${e.matches.filter((m) => m.hasBeenPlayed).length}/${e.matches.length})` },
            { value: 'awards', label: `Awards${e.awards.length ? ` (${e.awards.length})` : ''}` },
          ]}
        />
        <span className="flex-1" />
        <LiveBadge ctx={ctx} />
      </div>
      {view === 'rankings' && (
        <DataTable
          rows={rows}
          keyOf={(t) => t.number}
          empty={<EmptyState title="Rankings appear once qualification matches are played" />}
          columns={[
            { id: 'rank', header: '#', align: 'right', sort: (t) => t.stats?.rank ?? 999, cell: (t) => t.stats?.rank ?? '–' },
            {
              id: 'team',
              header: 'Team',
              sort: (t) => t.number,
              cell: (t) => (
                <button className={cn('text-left hover:underline', ctx.ours.includes(t.number) && 'font-semibold text-accent')} onClick={() => onTeam(t.number)}>
                  {t.number} <span className="text-muted">{t.name}</span>
                </button>
              ),
            },
            { id: 'rp', header: 'RP', align: 'right', sort: (t) => t.stats?.rp ?? -1, cell: (t) => t.stats?.rp?.toFixed(2) ?? '–' },
            { id: 'rec', header: 'W-L-T', align: 'right', sort: (t) => t.stats?.wins ?? -1, cell: (t) => (t.stats ? `${t.stats.wins}-${t.stats.losses}-${t.stats.ties}` : '–') },
            { id: 'opr', header: 'OPR', align: 'right', sort: (t) => t.stats?.opr?.totalPointsNp ?? -1, cell: (t) => t.stats?.opr?.totalPointsNp.toFixed(1) ?? '–' },
            { id: 'avg', header: 'Avg', align: 'right', sort: (t) => t.stats?.avg?.totalPointsNp ?? -1, cell: (t) => t.stats?.avg?.totalPointsNp.toFixed(1) ?? '–' },
            { id: 'mp', header: 'Played', align: 'right', cell: (t) => t.stats?.qualMatchesPlayed ?? 0 },
            {
              id: 'score',
              header: 'Pick score',
              align: 'right',
              sort: (t) => stats.composite.get(t.number) ?? -99,
              cell: (t) => {
                const s = stats.composite.get(t.number);
                return s == null ? '–' : <span className={s > 0.5 ? 'text-success font-medium' : s < -0.5 ? 'text-danger' : ''}>{s > 0 ? '+' : ''}{s.toFixed(2)}</span>;
              },
            },
          ]}
        />
      )}
      {view === 'matches' && (
        <>
          <Select value={filter} onChange={(ev) => setFilter(ev.target.value)} className="w-64" aria-label="Show matches for">
            <option value="all">All matches</option>
            {rows.map((t) => (
              <option key={t.number} value={t.number}>
                {t.number} {t.name ?? ''}
                {ctx.ours.includes(t.number) ? ' (us)' : ''}
              </option>
            ))}
          </Select>
          <div className="relative overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-subtle/60 text-left text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Match</th>
                  <th className="px-3 py-2 font-medium">Red</th>
                  <th className="px-3 py-2 font-medium">Blue</th>
                  <th className="px-3 py-2 text-right font-medium">Score / time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((m) => (
                  <MatchRow key={m.id} m={m} all={e.matches} ours={ctx.ours} onTeam={onTeam} highlight={filter === 'all' ? null : Number(filter)} />
                ))}
              </tbody>
            </table>
            {!sorted.length && <p className="p-4 text-center text-faint">No matches published yet.</p>}
          </div>
        </>
      )}
      {view === 'awards' &&
        (e.awards.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {[...e.awards]
              .sort((a, b) => a.type.localeCompare(b.type) || a.placement - b.placement)
              .map((a) => (
                <li key={`${a.type}-${a.placement}-${a.teamNumber}`} className={cn('flex items-center gap-2 rounded-lg border border-border bg-surface p-3 text-[13.5px]', a.teamNumber && ctx.ours.includes(a.teamNumber) && 'border-accent')}>
                  <Award className="size-4 text-warning" />
                  <span className="flex-1 font-medium">{awardLabel(a)}</span>
                  {a.teamNumber && (
                    <button className="text-muted hover:underline" onClick={() => onTeam(a.teamNumber!)}>
                      {a.teamNumber} {ctx.teams.find((t) => t.number === a.teamNumber)?.name}
                    </button>
                  )}
                </li>
              ))}
          </ul>
        ) : (
          <EmptyState icon={<Award />} title="No awards announced yet" body="They appear here as soon as they're published." />
        ))}
      <p className="text-[11.5px] text-faint">Rankings, matches and awards from FTCScout{ctx.live ? ' · refreshing every minute' : ''}.</p>
    </div>
  );
}

function MatchRow({ m, all, ours, onTeam, highlight }: { m: FtcMatch; all: FtcMatch[]; ours: number[]; onTeam: (n: number) => void; highlight: number | null }) {
  const red = m.scores?.red?.totalPoints;
  const blue = m.scores?.blue?.totalPoints;
  const side = (a: 'Red' | 'Blue') =>
    m.teams
      .filter((t) => t.alliance === a)
      .map((t) => (
        <button key={t.teamNumber} onClick={() => onTeam(t.teamNumber)} className={cn('mr-2 tabular hover:underline', (ours.includes(t.teamNumber) || t.teamNumber === highlight) && 'rounded bg-accent-soft px-1 font-semibold')}>
          {t.teamNumber}
        </button>
      ));
  const est = !m.hasBeenPlayed ? estimateStart(m, all) : null;
  return (
    <tr className={cn(!m.hasBeenPlayed && 'bg-bg-subtle/30')}>
      <td className="px-3 py-1.5 font-medium">{matchLabel(m)}</td>
      <td className={cn('px-3 py-1.5 text-red-600 dark:text-red-400', red != null && blue != null && red > blue && 'font-semibold')}>{side('Red')}</td>
      <td className={cn('px-3 py-1.5 text-blue-600 dark:text-blue-400', red != null && blue != null && blue > red && 'font-semibold')}>{side('Blue')}</td>
      <td className="tabular px-3 py-1.5 text-right">
        {m.hasBeenPlayed && red != null ? (
          <>
            <span className="text-red-600 dark:text-red-400">{red}</span> – <span className="text-blue-600 dark:text-blue-400">{blue}</span>
          </>
        ) : est ? (
          <span className="text-muted">~{formatTime(est)} <Badge>est.</Badge></span>
        ) : (
          <StatusPill label="Scheduled" />
        )}
      </td>
    </tr>
  );
}
