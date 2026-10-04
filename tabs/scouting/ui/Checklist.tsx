import { useState } from 'react';
import { CheckCircle2, Circle, CircleCheckBig, ClipboardPen, Eye } from 'lucide-react';
import { Badge, Button, Card, Meter, RelativeTime, SearchInput, Segmented, cn, matches as textMatches } from '@teamhub/ui';
import { PersonName } from '@teamhub/sdk';
import type { EventContext } from './event';
import type { useScoutingStats } from './stats';

/**
 * Every team at the event with a check-off: pit interview done? how many of its played matches were scouted?
 * Tap a team to open its form. Replaces the "who still needs scouting?" spreadsheet.
 */
export function TeamChecklist({ ctx, stats, onScout, onTeam }: { ctx: EventContext; stats: ReturnType<typeof useScoutingStats>; onScout: (kind: 'pit' | 'match', team: number) => void; onTeam: (n: number) => void }) {
  const [filter, setFilter] = useState<'todo' | 'done' | 'all'>('todo');
  const [mode, setMode] = useState<'pit' | 'match'>('pit');
  const [q, setQ] = useState('');
  const teams = ctx.teams.filter((t) => !ctx.ours.includes(t.number));
  const pit = (n: number) => stats.entries.filter((e) => e.kind === 'pit' && e.team_number === n);
  const played = (n: number) => ctx.matches.filter((m) => m.hasBeenPlayed && m.teams.some((x) => x.teamNumber === n)).length;
  const scouted = (n: number) => stats.scoutedCounts.get(n) ?? 0;
  const done = (n: number) => (mode === 'pit' ? pit(n).length > 0 : played(n) > 0 ? scouted(n) >= played(n) : scouted(n) > 0);
  const doneCount = teams.filter((t) => done(t.number)).length;
  const list = teams.filter((t) => (filter === 'all' || (filter === 'done') === done(t.number)) && (!q || textMatches(`${t.number} ${t.name ?? ''}`, q)));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'pit', label: 'Pit interviews' },
            { value: 'match', label: 'Match scouting' },
          ]}
        />
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'todo', label: `Not done (${teams.length - doneCount})` },
            { value: 'done', label: `Done (${doneCount})` },
            { value: 'all', label: 'All' },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Team number or name" className="w-56" />
      </div>
      <Card className="p-4">
        <Meter label={mode === 'pit' ? 'Teams interviewed' : 'Teams fully scouted (every played match)'} value={doneCount} max={Math.max(1, teams.length)} format={(n) => String(Math.round(n))} />
      </Card>
      {!list.length ? (
        <p className="py-8 text-center text-[13.5px] text-muted">{filter === 'todo' ? <><CircleCheckBig className="mx-auto mb-2 size-6 text-success" aria-hidden />Every team is done!</> : 'No teams here.'}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => {
            const d = done(t.number);
            const p = pit(t.number)[0];
            return (
              <li key={t.number} className={cn('flex items-center gap-3 rounded-lg border bg-surface p-3', d ? 'border-success/40' : 'border-border')}>
                {d ? <CheckCircle2 className="size-6 shrink-0 text-success" aria-label="Done" /> : <Circle className="size-6 shrink-0 text-border-strong" aria-label="Not done" />}
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onTeam(t.number)}>
                  <span className="tabular block font-semibold">{t.number}</span>
                  <span className="block truncate text-[12.5px] text-muted">{t.name ?? 'Unknown team'}</span>
                  <span className="block text-[11.5px] text-faint">
                    {mode === 'pit' ? (
                      p ? (
                        <>
                          by <PersonName id={p.scout} /> · <RelativeTime date={p.created_at} />
                        </>
                      ) : (
                        'Not interviewed yet'
                      )
                    ) : (
                      `${scouted(t.number)} of ${played(t.number)} played matches scouted`
                    )}
                  </span>
                </button>
                {mode === 'match' && !d && <Badge tone="warning">{Math.max(0, played(t.number) - scouted(t.number))} left</Badge>}
                <Button size="sm" variant={d ? 'ghost' : 'primary'} icon={mode === 'pit' ? <ClipboardPen className="size-3.5" /> : <Eye className="size-3.5" />} onClick={() => onScout(mode, t.number)}>
                  {mode === 'pit' ? (d ? 'Again' : 'Interview') : 'Scout'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
