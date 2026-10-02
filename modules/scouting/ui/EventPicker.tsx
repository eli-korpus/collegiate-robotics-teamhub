import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, Search, Trophy } from 'lucide-react';
import { seasonYear } from '@teamhub/config-schema/util';
import { Badge, Button, Dialog, Field, Input, Textarea, formatDate, toast } from '@teamhub/ui';
import { friendlyError, getTeamEvents, runtime, searchEvents, useCan, useMe, useSeason, useSupabase } from '@teamhub/sdk';
import { useManualEvents } from './event';

/** Choose the competition: your team's events, any FTCScout event, or a manual one (not on FTCScout). */
export function EventPicker({ value, name, onChange }: { value: string; name?: string; onChange: (code: string) => void }) {
  const label = useSeason();
  const season = seasonYear(label);
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const canScout = useCan('scouting.scout');
  const [open, setOpen] = useState(!value);
  const [q, setQ] = useState('');
  const [manualForm, setManualForm] = useState(false);
  const [m, setM] = useState({ name: '', code: '', date: '', teams: '' });
  const ourNumbers = runtime().config.teams.map((t) => t.number).filter((n): n is number => !!n);
  const mine = useQuery({
    queryKey: ['ftcscout', 'our-events', season, ourNumbers.join(',')],
    enabled: open && ourNumbers.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => (await Promise.all(ourNumbers.map((n) => getTeamEvents(n, season).catch(() => [])))).flat(),
  });
  const results = useQuery({ queryKey: ['ftcscout', 'search', season, q], enabled: open && q.length >= 2, staleTime: 60 * 60_000, queryFn: () => searchEvents(season, q) });
  const manual = useManualEvents();
  const pick = (code: string) => {
    onChange(code.toUpperCase());
    setOpen(false);
  };
  const ourEvents = [...new Map((mine.data ?? []).map((e) => [e.eventCode, e.event])).values()].sort((a, b) => a.start.localeCompare(b.start));
  return (
    <>
      <Button size="sm" icon={<Trophy className="size-3.5" />} onClick={() => setOpen(true)}>
        {value ? name || value : 'Choose competition'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Which competition?" description="Teams, rankings and matches load automatically from FTCScout. Not listed? Add it yourself." size="lg">
        {!manualForm ? (
          <div className="space-y-4">
            {ourEvents.length > 0 && (
              <section>
                <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-faint">Your team's events</p>
                <ul className="space-y-1">
                  {ourEvents.map((e) => (
                    <li key={e.code}>
                      <button type="button" onClick={() => pick(e.code)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13.5px] hover:bg-bg-subtle">
                        <CalendarDays className="size-4 text-muted" />
                        <span className="flex-1 font-medium">{e.name}</span>
                        <span className="text-[12px] text-faint">{formatDate(e.start)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {(manual.data?.length ?? 0) > 0 && (
              <section>
                <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-faint">Added by your team</p>
                <ul className="space-y-1">
                  {manual.data!.map((e) => (
                    <li key={e.code}>
                      <button type="button" onClick={() => pick(e.code)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13.5px] hover:bg-bg-subtle">
                        <span className="flex-1 font-medium">{e.name}</span>
                        <Badge>{e.teams.length} teams</Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="space-y-2">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">Any event on FTCScout</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-faint" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, city or event code" className="pl-8" />
              </div>
              <ul className="max-h-60 space-y-1 overflow-y-auto">
                {(results.data ?? []).map((e) => (
                  <li key={e.code}>
                    <button type="button" className="w-full rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-bg-subtle" onClick={() => pick(e.code)}>
                      <span className="font-medium">{e.name}</span>{' '}
                      <span className="text-faint">
                        {e.code} · {formatDate(e.start)} · {[e.location?.city, e.location?.state].filter(Boolean).join(', ')}
                      </span>
                    </button>
                  </li>
                ))}
                {q.length >= 2 && results.data?.length === 0 && <li className="px-2 text-[12.5px] text-faint">No matching events on FTCScout.</li>}
              </ul>
            </section>
            {canScout && (
              <Button variant="ghost" icon={<Plus className="size-4" />} onClick={() => setManualForm(true)}>
                It's not on FTCScout — add it myself
              </Button>
            )}
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const teams = [...new Set(m.teams.split(/[^0-9]+/).filter(Boolean).map(Number).filter((n) => n > 0))];
              const code = (m.code || m.name).toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 20);
              if (!m.name.trim() || code.length < 2) return toast.error('Give the event a name');
              const { error } = await sb.from('sct_events').upsert({ code, name: m.name.trim(), start_date: m.date || null, teams, created_by: me.id });
              if (error) return toast.error(friendlyError(error));
              qc.invalidateQueries({ queryKey: ['scouting', 'manual-events'] });
              setManualForm(false);
              pick(code);
            }}
          >
            <Field label="Event name">{(id) => <Input id={id} autoFocus value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} placeholder="Fall scrimmage at Lincoln HS" />}</Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Short code" optional hint="Letters and digits">{(id) => <Input id={id} value={m.code} onChange={(e) => setM({ ...m, code: e.target.value })} />}</Field>
              <Field label="Date" optional>{(id) => <Input id={id} type="date" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} />}</Field>
            </div>
            <Field label="Team numbers" hint="Paste them separated by spaces, commas or new lines. Names and season stats load from FTCScout.">
              {(id) => <Textarea id={id} rows={4} value={m.teams} onChange={(e) => setM({ ...m, teams: e.target.value })} placeholder="23209 22359 18898 …" />}
            </Field>
            <div className="flex gap-2">
              <Button type="submit" variant="primary">
                Add event
              </Button>
              <Button onClick={() => setManualForm(false)}>Back</Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
