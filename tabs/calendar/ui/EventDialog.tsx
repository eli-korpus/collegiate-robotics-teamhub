import { useState } from 'react';
import { Button, Checkbox, Dialog, Field, Input, Select, Switch, Textarea, toast, toDateInput, validateRequired } from '@teamhub/ui';
import { canWith, friendlyError, isMultiTeam, ModulePurpose, runtime, ScopeVisibility, TeamScopePicker, useMe, useSupabase, useTeamScope } from '@teamhub/sdk';
import { KINDS, type Kind } from '../kinds';
import { WEEKDAYS, formatRule, parseRule, type Weekday } from '../rrule';
import { allDayToDate, dateToAllDay, type CalEvent } from '../data';
import { CompetitionPicker } from './CompetitionPicker';

type Repeat = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export interface EventDraft {
  date?: string;
  kind?: Kind;
  title?: string;
}

/** Create or edit an event (whole series). Visibility is chosen up front and shown (spec P6). */
export function EventDialog({ open, onClose, event, draft, onSaved }: { open: boolean; onClose: () => void; event?: CalEvent | null; draft?: EventDraft; onSaved?: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const scope = useTeamScope();
  const start = event ? (event.all_day ? allDayToDate(event.starts_at) : new Date(event.starts_at)) : null;
  const end = event?.ends_at ? (event.all_day ? allDayToDate(event.ends_at) : new Date(event.ends_at)) : null;
  const rule = parseRule(event?.recurrence);
  const [title, setTitle] = useState(event?.title ?? draft?.title ?? '');
  const [kind, setKind] = useState<Kind>(event?.kind ?? draft?.kind ?? 'practice');
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [date, setDate] = useState(start ? toDateInput(start) : draft?.date ?? toDateInput(new Date()));
  const [endDate, setEndDate] = useState(end && event?.all_day ? toDateInput(end) : '');
  const [from, setFrom] = useState(start && !event?.all_day ? hhmm(start) : '15:30');
  const [to, setTo] = useState(end && !event?.all_day ? hhmm(end) : '18:00');
  const [location, setLocation] = useState(event?.location ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [teamId, setTeamId] = useState<string | null>(event ? event.team_id : scope);
  const [eventCode, setEventCode] = useState(event?.event_code ?? '');
  const [repeat, setRepeat] = useState<Repeat>(!rule ? 'none' : rule.freq === 'DAILY' ? 'daily' : rule.freq === 'MONTHLY' ? 'monthly' : rule.interval === 2 ? 'biweekly' : 'weekly');
  const [days, setDays] = useState<Weekday[]>(rule?.byDay.length ? rule.byDay : [WEEKDAYS[(start ?? new Date(`${date}T12:00`)).getDay()]]);
  const [until, setUntil] = useState(rule?.until ? toDateInput(rule.until) : '');
  const [busy, setBusy] = useState(false);
  // A competition belongs to one team (two teams at the same event = two calendar events), so the Events and
  // Competition Day pages know whose competition it is.
  const oneTeam = kind === 'competition' && isMultiTeam();

  const save = async () => {
    if (oneTeam && !teamId) {
      validateRequired();
      return toast.error('Pick the team that is competing');
    }
    if (kind === 'competition' && eventCode.trim()) {
      let dup = sb.from('cal_events').select('id').eq('kind', 'competition').ilike('event_code', eventCode.trim());
      dup = teamId ? dup.eq('team_id', teamId) : dup.is('team_id', null);
      const { data } = await dup;
      if ((data ?? []).some((d: { id: string }) => d.id !== event?.id)) return toast.error('This team already has this competition on the calendar.');
    }

    if (!validateRequired()) return;
    if (!title.trim()) return toast.error('Give the event a title');
    const starts_at = allDay ? dateToAllDay(date) : new Date(`${date}T${from}`).toISOString();
    let ends_at: string | null;
    if (allDay) ends_at = endDate && endDate > date ? dateToAllDay(endDate) : null;
    else {
      const e = new Date(`${date}T${to}`);
      if (e <= new Date(`${date}T${from}`)) return toast.error('End time must be after the start time');
      ends_at = e.toISOString();
    }
    const recurrence =
      repeat === 'none'
        ? null
        : formatRule({
            freq: repeat === 'daily' ? 'DAILY' : repeat === 'monthly' ? 'MONTHLY' : 'WEEKLY',
            interval: repeat === 'biweekly' ? 2 : 1,
            byDay: repeat === 'weekly' || repeat === 'biweekly' ? days : [],
            until: until ? new Date(`${until}T23:59:59`) : null,
            count: null,
          });
    const row = {
      title: title.trim(),
      kind,
      all_day: allDay,
      starts_at,
      ends_at,
      location: location.trim() || null,
      notes: notes.trim() || null,
      team_id: teamId,
      recurrence,
      event_code: kind === 'competition' && eventCode.trim() ? eventCode.trim().toUpperCase() : null,
    };
    setBusy(true);
    const res = event ? await sb.from('cal_events').update(row).eq('id', event.id) : await sb.from('cal_events').insert({ ...row, created_by: me.id });
    setBusy(false);
    if (res.error) return toast.error(friendlyError(res.error));
    toast.success(event ? 'Event updated' : 'Event added');
    onSaved?.();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={event ? 'Edit event' : 'New event'}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={busy}>
            {event ? 'Save changes' : 'Add to calendar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!event && <ModulePurpose moduleId="calendar" compact />}
        {oneTeam ? (
          <Field label="Competing team" required hint="One team per competition. If two of your teams go, add an event for each.">
            {(id) => (
              <Select id={id} value={teamId ?? ''} onChange={(e) => setTeamId(e.target.value || null)}>
                <option value="">Pick a team</option>
                {runtime()
                  .config.teams.filter((t) => canWith(me, 'calendar.create', t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.number ? ` (${t.number})` : ''}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        ) : (
          <TeamScopePicker value={teamId} onChange={setTeamId} perm="calendar.create" />
        )}
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Field label="Title" required>{(id) => <Input id={id} autoFocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Build practice" />}</Field>
          <Field label="Kind">
            {(id) => (
              <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {Object.entries(KINDS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Switch checked={allDay} onChange={setAllDay} label="All day" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={allDay ? 'Start date' : 'Date'} required>{(id) => <Input id={id} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          {allDay ? (
            <Field label="End date" optional>
              {(id) => <Input id={id} type="date" min={date} value={endDate} onChange={(e) => setEndDate(e.target.value)} />}
            </Field>
          ) : (
            <>
              <Field label="From" required>{(id) => <Input id={id} type="time" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
              <Field label="To" required>{(id) => <Input id={id} type="time" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
            </>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Repeats">
            {(id) => (
              <Select id={id} value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
                <option value="none">Does not repeat</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Every month</option>
              </Select>
            )}
          </Field>
          {repeat !== 'none' && (
            <Field label="Until" optional hint="Leave empty to repeat all season">
              {(id) => <Input id={id} type="date" min={date} value={until} onChange={(e) => setUntil(e.target.value)} />}
            </Field>
          )}
        </div>
        {(repeat === 'weekly' || repeat === 'biweekly') && (
          <div className="flex flex-wrap gap-3">
            {WEEKDAYS.map((d) => (
              <Checkbox key={d} checked={days.includes(d)} onChange={(v) => setDays(v ? [...days, d] : days.filter((x) => x !== d))} label={d.charAt(0) + d.slice(1).toLowerCase()} />
            ))}
          </div>
        )}
        <Field label="Location" optional>{(id) => <Input id={id} value={location} maxLength={200} onChange={(e) => setLocation(e.target.value)} />}</Field>
        {kind === 'competition' && (
          <CompetitionPicker
            teamId={teamId}
            code={eventCode}
            onCode={setEventCode}
            onPick={(c) => {
              setEventCode(c.code);
              if (!title.trim()) setTitle(c.name);
              setAllDay(true);
              setDate(c.start.slice(0, 10));
              setEndDate(c.end.slice(0, 10));
            }}
          />
        )}
        <Field label="Notes" optional>{(id) => <Textarea id={id} rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
        <ScopeVisibility teamId={teamId} />
      </div>
    </Dialog>
  );
}
