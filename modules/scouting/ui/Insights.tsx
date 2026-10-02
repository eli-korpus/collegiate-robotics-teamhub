import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, Eye, Minus, Pencil, Trash2, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { Badge, Banner, Button, Card, CardHeader, DataTable, Dialog, EmptyState, FormRenderer, IconButton, Input, MiniBarChart, RelativeTime, Sparkline, StatTile, cn, toast, useConfirm, type FieldDef, type FormValues } from '@teamhub/ui';
import { awardLabel, canWith, friendlyError, ftcscoutTeamUrl, ordinal, PersonName, useMe, useSupabase } from '@teamhub/sdk';
import { coverage, highlights, matchHistory, mean, stdev, trend } from '../insights';
import type { EventContext } from './event';
import type { Entry, Template, useScoutingStats } from './stats';

const fmt = (v: unknown) => (v == null || v === '' ? '–' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : Array.isArray(v) ? v.join(', ') : String(v));

export function TrendIcon({ slope }: { slope: number | null }) {
  if (slope == null) return <span className="text-faint">–</span>;
  if (slope > 2) return <TrendingUp className="inline size-4 text-success" aria-label="Improving" />;
  if (slope < -2) return <TrendingDown className="inline size-4 text-danger" aria-label="Declining" />;
  return <Minus className="inline size-4 text-muted" aria-label="Steady" />;
}

export function Insights({ ctx, stats, onTeam, compare, setCompare }: { ctx: EventContext; stats: ReturnType<typeof useScoutingStats>; onTeam: (n: number) => void; compare: number[]; setCompare: (c: number[]) => void }) {
  const fields = stats.fields;
  const rows = useMemo(
    () =>
      ctx.teams.map((t) => {
        const h = matchHistory(ctx.matches, t.number).map((x) => x.score);
        return { t, h, avg: mean(h), sd: stdev(h), slope: trend(h), n: stats.scoutedCounts.get(t.number) ?? 0, score: stats.composite.get(t.number) ?? null };
      }),
    [ctx.teams, ctx.matches, stats],
  );
  const cov = coverage(ctx.teams.map((t) => t.number), stats.scoutedCounts, ctx.matches, ctx.ours[0]);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Teams" value={ctx.teams.length} />
        <StatTile label="Matches played" value={`${ctx.matches.filter((m) => m.hasBeenPlayed).length}/${ctx.matches.length || '–'}`} />
        <StatTile label="Scouting entries" value={stats.entries.length} />
        <StatTile label="Teams not scouted" value={cov.unscouted.length} tone={cov.unscouted.length ? 'warning' : 'success'} />
      </div>
      {cov.unscouted.length > 0 && (
        <Card>
          <CardHeader icon={<Eye className="size-4" />} title="Scouting coverage" subtitle="Teams nobody has scouted yet: catch them in these matches" />
          <div className="space-y-2 px-4 pb-4 text-[13px]">
            {cov.upcoming.length > 0 ? (
              <ul className="space-y-1">
                {cov.upcoming.map((m) => (
                  <li key={m.label}>
                    <span className="font-semibold">{m.label}:</span> {m.teams.map((n) => `${n}${ctx.teams.find((t) => t.number === n)?.name ? ` (${ctx.teams.find((t) => t.number === n)!.name})` : ''}`).join(', ')}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">{cov.unscouted.join(', ')}</p>
            )}
          </div>
        </Card>
      )}
      {compare.length > 0 && <Compare ctx={ctx} stats={stats} teams={compare} onClear={() => setCompare([])} />}
      <DataTable
        rows={rows}
        keyOf={(r) => r.t.number}
        empty={<EmptyState title="No teams yet" body="Pick an event that's on FTCScout, or add its team list." />}
        columns={[
          {
            id: 'team',
            header: 'Team',
            sort: (r) => r.t.number,
            cell: (r) => (
              <button className={cn('text-left hover:underline', ctx.ours.includes(r.t.number) && 'text-accent')} onClick={() => onTeam(r.t.number)}>
                <span className="font-semibold">{r.t.number}</span> <span className="text-[12px] text-muted">{r.t.name}</span>
              </button>
            ),
          },
          { id: 'rank', header: 'Rank', align: 'right', sort: (r) => r.t.stats?.rank ?? 999, cell: (r) => r.t.stats?.rank ?? '–' },
          { id: 'opr', header: 'OPR', align: 'right', sort: (r) => r.t.stats?.opr?.totalPointsNp ?? -1, cell: (r) => r.t.stats?.opr?.totalPointsNp.toFixed(1) ?? '–' },
          { id: 'season', header: 'Season OPR', align: 'right', sort: (r) => r.t.season?.tot?.value ?? -1, cell: (r) => (r.t.season?.tot ? <span title={`World rank ${r.t.season.tot.rank}`}>{r.t.season.tot.value.toFixed(1)} <span className="text-[11px] text-faint">#{r.t.season.tot.rank}</span></span> : '–') },
          { id: 'cons', header: 'Consistency', align: 'right', sort: (r) => (r.sd == null ? 999 : r.sd), cell: (r) => (r.sd == null ? '–' : `±${r.sd.toFixed(0)}`) },
          { id: 'trend', header: 'Trend', align: 'center', sort: (r) => r.slope ?? 0, cell: (r) => <TrendIcon slope={r.slope} /> },
          ...fields.slice(0, 4).map((f) => ({
            id: f.id,
            header: f.label,
            align: 'right' as const,
            sort: (r: (typeof rows)[number]) => stats.teamAvg.get(r.t.number)?.[f.id] ?? -1,
            cell: (r: (typeof rows)[number]) => {
              const v = stats.teamAvg.get(r.t.number)?.[f.id];
              const e = stats.eventAvg[f.id];
              if (v == null) return <span className="text-faint">–</span>;
              return <span className={cn(e && v >= e * 1.25 && 'font-medium text-success', e && v <= e * 0.75 && 'text-danger')}>{f.type === 'checkbox' ? `${Math.round(v * 100)}%` : v.toFixed(1)}</span>;
            },
          })),
          { id: 'n', header: 'Scouted', align: 'right', sort: (r) => r.n, cell: (r) => (r.n ? r.n : <Badge tone="warning">0</Badge>) },
          { id: 'score', header: 'Pick score', align: 'right', sort: (r) => r.score ?? -99, cell: (r) => (r.score == null ? '–' : `${r.score > 0 ? '+' : ''}${r.score.toFixed(2)}`) },
          {
            id: 'cmp',
            header: '',
            cell: (r) => (
              <button className={cn('text-[12px] font-medium', compare.includes(r.t.number) ? 'text-accent' : 'text-muted hover:text-fg')} onClick={() => setCompare(compare.includes(r.t.number) ? compare.filter((x) => x !== r.t.number) : [...compare, r.t.number].slice(-3))}>
                {compare.includes(r.t.number) ? <><Check className="inline size-3.5" aria-hidden /> Comparing</> : 'Compare'}
              </button>
            ),
          },
        ]}
      />
      <p className="text-[11.5px] text-faint">
        Consistency = spread of the team's alliance scores; trend = change per match through the event; green/red = 25% above/below the event average in your scouting; pick score combines OPR and every scouted number.
      </p>
    </div>
  );
}

function Compare({ ctx, stats, teams, onClear }: { ctx: EventContext; stats: ReturnType<typeof useScoutingStats>; teams: number[]; onClear: () => void }) {
  const t = (n: number) => ctx.teams.find((x) => x.number === n);
  const rows: [string, (n: number) => string][] = [
    ['Rank', (n) => String(t(n)?.stats?.rank ?? '–')],
    ['Record', (n) => (t(n)?.stats ? `${t(n)!.stats!.wins}-${t(n)!.stats!.losses}-${t(n)!.stats!.ties}` : '–')],
    ['Event OPR', (n) => t(n)?.stats?.opr?.totalPointsNp.toFixed(1) ?? '–'],
    ['Season OPR (world rank)', (n) => (t(n)?.season?.tot ? `${t(n)!.season!.tot!.value.toFixed(1)} (#${t(n)!.season!.tot!.rank})` : '–')],
    ['Avg alliance score', (n) => mean(matchHistory(ctx.matches, n).map((x) => x.score))?.toFixed(1) ?? '–'],
    ...stats.fields.map((f): [string, (n: number) => string] => [f.label, (n) => { const v = stats.teamAvg.get(n)?.[f.id]; return v == null ? '–' : f.type === 'checkbox' ? `${Math.round(v * 100)}%` : v.toFixed(1); }]),
    ['Pick score', (n) => stats.composite.get(n)?.toFixed(2) ?? '–'],
  ];
  return (
    <Card>
      <CardHeader title="Side by side" action={<button className="text-[12px] text-accent" onClick={onClear}>Clear</button>} />
      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full text-[13px]">
          <thead>
            <tr>
              <th />
              {teams.map((n) => (
                <th key={n} className="px-2 text-left">
                  {n} <span className="font-normal text-muted">{t(n)?.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(([label, get]) => (
              <tr key={label}>
                <td className="py-1 text-muted">{label}</td>
                {teams.map((n) => (
                  <td key={n} className="tabular px-2">
                    {get(n)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Full team profile: FTCScout stats, match-by-match results, scouting vs event average, notes and pit data. */
export function TeamProfile({ n, ctx, stats, templates, onClose }: { n: number; ctx: EventContext; stats: ReturnType<typeof useScoutingStats>; templates: Template[]; onClose: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const t = ctx.teams.find((x) => x.number === n);
  const hist = matchHistory(ctx.matches, n);
  const hl = highlights(stats.fields, stats.teamAvg.get(n) ?? {}, stats.eventAvg);
  const entries = stats.byTeam.get(n) ?? [];
  const awards = ctx.awards.filter((a) => a.teamNumber === n);
  const textFields = [...templates.flatMap((x) => x.fields)].filter((f) => f.type === 'text');
  const upcoming = ctx.matches.filter((m) => !m.hasBeenPlayed && m.teams.some((x) => x.teamNumber === n)).sort((a, b) => a.id - b.id);
  const [editing, setEditing] = useState<{ e: Entry; fields: FieldDef[] } | null>(null);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={`${n} ${t?.name ?? ''}`} description={[t?.city, t?.season?.tot && `Season OPR ${t.season.tot.value.toFixed(1)} · ${ordinal(t.season.tot.rank)} worldwide`].filter(Boolean).join(' · ')} size="xl">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <StatTile label="Rank" value={t?.stats?.rank ?? '–'} hint={t?.stats ? `${t.stats.rp?.toFixed(2) ?? '–'} RP` : undefined} />
          <StatTile label="Record" value={t?.stats ? `${t.stats.wins}-${t.stats.losses}-${t.stats.ties}` : '–'} />
          <StatTile label="OPR (no penalties)" value={t?.stats?.opr?.totalPointsNp.toFixed(1) ?? '–'} />
          <StatTile label="Avg alliance score" value={mean(hist.map((h) => h.score))?.toFixed(1) ?? '–'} hint={stdev(hist.map((h) => h.score)) != null ? `±${stdev(hist.map((h) => h.score))!.toFixed(0)} · ${trend(hist.map((h) => h.score))! > 0 ? 'improving' : 'not improving'}` : undefined} />
        </div>
        {awards.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {awards.map((a) => (
              <Badge key={a.type + a.placement} tone="warning">
                <Trophy className="inline size-3.5 text-warning" aria-hidden /> {awardLabel(a)}
              </Badge>
            ))}
          </div>
        )}
        {hist.length > 0 && (
          <Card>
            <CardHeader title="Match by match" subtitle="Alliance score (no penalties); green = won" />
            <div className="flex flex-wrap items-end gap-4 px-4 pb-4">
              <Sparkline values={hist.map((h) => h.score)} width={200} height={48} label="Alliance scores" />
              <ul className="flex flex-wrap gap-1.5 text-[12px]">
                {hist.map((h) => (
                  <li key={h.matchId} className={cn('rounded px-1.5 py-0.5', h.won ? 'bg-success-soft text-success' : h.won === false ? 'bg-danger-soft text-danger' : 'bg-bg-subtle')}>
                    {h.label} {h.score}–{h.opp}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        )}
        {upcoming.length > 0 && (
          <p className="text-[13px] text-muted">
            Still to play: {upcoming.map((m) => (m.tournamentLevel === 'Quals' ? `Q${m.matchNum}` : m.description)).join(', ')}
          </p>
        )}
        {(hl.strengths.length > 0 || hl.weaknesses.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-3 text-[13px]">
              <p className="mb-1 font-semibold text-success">Strengths</p>
              {hl.strengths.length ? hl.strengths.map((h) => <p key={h.fieldId}>{h.label}: {h.team.toFixed(1)} vs event {h.event.toFixed(1)} (+{Math.round((h.ratio - 1) * 100)}%)</p>) : <p className="text-faint">None stand out yet.</p>}
            </Card>
            <Card className="p-3 text-[13px]">
              <p className="mb-1 font-semibold text-danger">Weaknesses</p>
              {hl.weaknesses.length ? hl.weaknesses.map((h) => <p key={h.fieldId}>{h.label}: {h.team.toFixed(1)} vs event {h.event.toFixed(1)} ({Math.round((h.ratio - 1) * 100)}%)</p>) : <p className="text-faint">None stand out yet.</p>}
            </Card>
          </div>
        )}
        {stats.fields.length > 0 && Object.keys(stats.teamAvg.get(n) ?? {}).length > 0 && (
          <Card>
            <CardHeader title="Scouting vs event average" />
            <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
              {stats.fields
                .filter((f) => stats.teamAvg.get(n)?.[f.id] != null)
                .map((f) => (
                  <div key={f.id}>
                    <p className="mb-1 text-[12.5px] font-medium">{f.label}</p>
                    <MiniBarChart
                      height={70}
                      data={[
                        { label: String(n), value: stats.teamAvg.get(n)![f.id], color: 'var(--accent)' },
                        { label: 'Event', value: stats.eventAvg[f.id] ?? 0, color: 'var(--border-strong)' },
                      ]}
                      format={(v) => (f.type === 'checkbox' ? `${Math.round(v * 100)}%` : v.toFixed(1))}
                    />
                  </div>
                ))}
            </div>
          </Card>
        )}
        <section className="space-y-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-faint">Scouting entries ({entries.length})</h3>
          {!entries.length && <Banner tone="info">Nobody has scouted this team yet{upcoming[0] ? `. They play ${upcoming[0].tournamentLevel === 'Quals' ? `Q${upcoming[0].matchNum}` : 'soon'}` : ''}.</Banner>}
          {entries.map((e) => {
            const tf = templates.find((x) => x.id === e.template_id)?.fields ?? [];
            return (
              <div key={e.id} className="rounded-md border border-border p-3 text-[13px]">
                <div className="mb-1 flex items-center gap-2">
                  <Badge>{e.kind === 'pit' ? 'Pit' : e.match_label ?? 'Match'}</Badge>
                  <span className="text-muted">
                    <PersonName id={e.scout} /> · <RelativeTime date={e.created_at} />
                  </span>
                  {(e.scout === me.id || canWith(me, 'scouting.delete_entries')) && (
                    <IconButton label="Edit entry" size="sm" className="ml-auto" onClick={() => setEditing({ e, fields: tf })}>
                      <Pencil className="size-3.5" />
                    </IconButton>
                  )}
                  {(e.scout === me.id || canWith(me, 'scouting.delete_entries')) && (
                    <IconButton
                      label="Delete entry"
                      size="sm"
                      onClick={async () => {
                        if (!(await confirm({ title: 'Delete this entry?', danger: true, confirmLabel: 'Delete' }))) return;
                        await sb.from('sct_entries').delete().eq('id', e.id);
                        qc.invalidateQueries({ queryKey: ['scouting', 'entries'] });
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  )}
                </div>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
                  {tf.map((f) => (
                    <div key={f.id} className="contents">
                      <dt className="text-muted">{f.label}</dt>
                      <dd className={textFields.some((x) => x.id === f.id) ? 'whitespace-pre-wrap' : ''}>{fmt(e.data[f.id])}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </section>
        <a href={ftcscoutTeamUrl(n)} target="_blank" rel="noreferrer" className="text-[12.5px] text-accent hover:underline">
          Full history on FTCScout <ExternalLink className="inline size-3" aria-hidden />
        </a>
      </div>
      {editing && <EditEntry entry={editing.e} fields={editing.fields} onClose={() => setEditing(null)} />}
    </Dialog>
  );
}

/** Fix a submitted scouting answer (the scout who entered it, or people who can delete entries). */
function EditEntry({ entry, fields, onClose }: { entry: Entry; fields: FieldDef[]; onClose: () => void }) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const [values, setValues] = useState<FormValues>(entry.data);
  const [match, setMatch] = useState(entry.match_label ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await sb.from('sct_entries').update({ data: values, match_label: entry.kind === 'match' ? match.trim().toUpperCase() || null : null }).eq('id', entry.id);
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success('Entry updated');
    qc.invalidateQueries({ queryKey: ['scouting', 'entries'] });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Edit ${entry.kind === 'pit' ? 'pit' : 'match'} entry for #${entry.team_number}`} size="lg" footer={<Button variant="primary" loading={busy} onClick={save}>Save changes</Button>}>
      <div className="space-y-4">
        {entry.kind === 'match' && (
          <label className="block space-y-1">
            <span className="text-[13px] font-medium">Match</span>
            <Input className="w-32" value={match} maxLength={20} onChange={(e) => setMatch(e.target.value.toUpperCase())} />
          </label>
        )}
        {fields.length ? <FormRenderer fields={fields} values={values} onChange={setValues} /> : <p className="text-[13px] text-muted">This entry's form was deleted, so its answers can't be edited.</p>}
      </div>
    </Dialog>
  );
}
