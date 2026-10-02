import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { Banner, Button, EmptyState, FormRenderer, Input, Segmented, Select, VisibilityNote, cn, emptyValues, formatTime, toast, type FormValues } from '@teamhub/ui';
import { canWith, friendlyError, matchLabel, useLocalStorage, useMe, useSupabase } from '@teamhub/sdk';
import type { EventContext } from './event';
import { estimateStart, type Kind, type Template, type useScoutingStats } from './stats';

/** Phone-first entry: pick the match and robot position (team fills in) or pick a team; drafts survive bad Wi-Fi. */
export function Scout({ ctx, stats, templates, canForms, goForms, initial }: { ctx: EventContext; stats: ReturnType<typeof useScoutingStats>; templates: Template[]; canForms: boolean; goForms: () => void; initial?: { kind: Kind; team: number } | null }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>(initial?.kind ?? 'match');
  const t = templates.find((x) => x.kind === kind);
  const [draft, setDraft] = useLocalStorage<{ team: string; match: string; values: FormValues } | null>(`teamhub-scout-draft:${ctx.code}:${kind}`, null);
  const [team, setTeam] = useState(initial ? String(initial.team) : (draft?.team ?? ''));
  const [match, setMatch] = useState(draft?.match ?? '');
  const [values, setValues] = useState<FormValues>(draft?.values ?? (t ? emptyValues(t.fields) : {}));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (team || match || Object.values(values).some((v) => v !== null && v !== 0 && v !== false && !(Array.isArray(v) && !v.length))) setDraft({ team, match, values });
     
  }, [team, match, values]);
  useEffect(() => {
    if (!draft && t) setValues(emptyValues(t.fields));
     
  }, [t?.id, kind]);

  if (!canWith(me, 'scouting.scout')) return <Banner tone="info">You don't have scouting access — ask a captain.</Banner>;
  if (!t || !t.fields.length)
    return <EmptyState icon={<ClipboardCheck />} title={`No ${kind} scouting form yet`} body="Your scouting lead builds this season's form first." action={canForms && <Button onClick={goForms}>Build the form</Button>} />;

  const upcoming = ctx.matches.filter((m) => m.tournamentLevel === 'Quals' || !m.hasBeenPlayed).sort((a, b) => a.id - b.id);
  const current = upcoming.find((m) => matchLabel(m) === match);
  const nextUnplayed = upcoming.find((m) => !m.hasBeenPlayed);
  const teamName = (n: number) => ctx.teams.find((x) => x.number === n)?.name ?? '';
  const already = (n: number) => stats.entries.some((e) => e.kind === kind && e.team_number === n && (kind === 'pit' || e.match_label === match));

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Segmented value={kind} onChange={setKind} options={[{ value: 'match', label: 'Match scouting' }, { value: 'pit', label: 'Pit scouting' }]} />
      {kind === 'match' && upcoming.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Select value={match} onChange={(e) => (setMatch(e.target.value), setTeam(''))} className="h-11 flex-1 text-[15px]" aria-label="Match">
              <option value="">Choose a match…</option>
              {upcoming.map((m) => {
                const est = estimateStart(m, ctx.matches);
                return (
                  <option key={m.id} value={matchLabel(m)}>
                    {matchLabel(m)} {m.hasBeenPlayed ? '(played)' : est ? `· ~${formatTime(est)}` : ''}
                  </option>
                );
              })}
            </Select>
            {nextUnplayed && (
              <Button onClick={() => (setMatch(matchLabel(nextUnplayed)), setTeam(''))} size="lg">
                Next: {matchLabel(nextUnplayed)}
              </Button>
            )}
          </div>
          {current && (
            <div className="grid grid-cols-2 gap-2">
              {(['Red', 'Blue'] as const).map((side) => (
                <div key={side} className="space-y-1.5">
                  {current.teams
                    .filter((x) => x.alliance === side)
                    .map((x) => (
                      <button
                        key={x.teamNumber}
                        type="button"
                        onClick={() => setTeam(String(x.teamNumber))}
                        className={cn(
                          'w-full rounded-lg border-2 px-3 py-2 text-left',
                          side === 'Red' ? 'border-red-500/40' : 'border-blue-500/40',
                          team === String(x.teamNumber) && (side === 'Red' ? 'bg-red-500/15' : 'bg-blue-500/15'),
                        )}
                      >
                        <span className="tabular block text-[18px] font-bold">{x.teamNumber}</span>
                        <span className="block truncate text-[12px] text-muted">
                          {teamName(x.teamNumber)} {already(x.teamNumber) && '(scouted)'}
                        </span>
                      </button>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-[13px] font-medium">Team #</span>
          <Input inputMode="numeric" list="sct-teams" className="h-12 text-[20px] font-semibold" value={team} onChange={(e) => setTeam(e.target.value.replace(/\D/g, ''))} />
          <datalist id="sct-teams">
            {ctx.teams.map((x) => (
              <option key={x.number} value={x.number}>
                {x.name}
              </option>
            ))}
          </datalist>
          {team && <span className="block truncate text-[12px] text-muted">{teamName(Number(team)) || 'Not in this event’s team list'}</span>}
        </label>
        {kind === 'match' && (
          <label className="space-y-1">
            <span className="text-[13px] font-medium">Match</span>
            <Input className="h-12 text-[20px] font-semibold" value={match} onChange={(e) => setMatch(e.target.value.toUpperCase())} placeholder="Q12" maxLength={20} />
          </label>
        )}
      </div>
      {team && already(Number(team)) && <Banner tone="warning">Someone already scouted #{team}{kind === 'match' ? ` in ${match}` : "'s pit"}. Submitting adds a second entry.</Banner>}
      <FormRenderer fields={t.fields} values={values} onChange={setValues} />
      <VisibilityNote>Visible to your program's scouts and mentors — keep it respectful.</VisibilityNote>
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          loading={busy}
          disabled={!team}
          onClick={async () => {
            setBusy(true);
            const { error } = await sb.from('sct_entries').insert({ template_id: t.id, template_version: t.version, kind, season: t.season, event_code: ctx.code, match_label: kind === 'match' ? match || null : null, team_number: Number(team), data: values, scout: me.id });
            setBusy(false);
            if (error) return toast.error(`${friendlyError(error)} — your answers are saved on this device; try again.`);
            toast.success(`Saved ${kind === 'match' ? match : 'pit'} for #${team}`);
            setDraft(null);
            setTeam('');
            setValues(emptyValues(t.fields));
            qc.invalidateQueries({ queryKey: ['scouting', 'entries'] });
          }}
        >
          Submit
        </Button>
        <Button size="lg" onClick={() => (setDraft(null), setValues(emptyValues(t.fields)), setTeam(''))}>
          Clear
        </Button>
      </div>
    </div>
  );
}
