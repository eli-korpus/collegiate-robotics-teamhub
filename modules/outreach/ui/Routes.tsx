import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Download, HeartHandshake, MapPin, Pencil, Plus, Trash2, Users } from 'lucide-react';
import {
  Avatar,
  Banner,
  Button,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  ListRow,
  MiniBarChart,
  Segmented,
  Select,
  SmartGroupList,
  Spinner,
  StatTile,
  StatusPill,
  Textarea,
  downloadText,
  formatDate,
  toCsv,
  toDateInput,
  toast,
  useConfirm,
} from '@teamhub/ui';
import {
  canWith,
  friendlyError,
  ModuleHeader,
  ModulePurpose,
  ScopeVisibility,
  Slot,
  TeamBadge,
  TeamScopePicker,
  useCan,
  useCreateShortcut,
  useLocalStorage,
  useMe,
  useModuleSettings,
  useNewParam,
  usePeople,
  useSeason,
  useSelectedParam,
  useSupabase,
  useTeamScope,
} from '@teamhub/sdk';
import { round, totals, useHours, useOutEvents, type Hours, type OutEvent } from './data';

export default function OutreachRoutes() {
  const season = useSeason();
  const events = useOutEvents(season);
  const hours = useHours();
  const scope = useTeamScope();
  const me = useMe();
  const canCreate = useCan('outreach.create_event');
  const canApprove = useCan('outreach.approve_hours');
  const [view, setView] = useLocalStorage<'events' | 'totals'>('teamhub-outreach-view', 'events');
  const [creating, setCreating, params] = useNewParam();
  const [selected, setSelected] = useSelectedParam();
  const [editing, setEditing] = useState<OutEvent | null>(null);
  useCreateShortcut(() => setCreating(true), canCreate);
  const list = (events.data ?? []).filter((e) => !scope || !e.team_id || e.team_id === scope);
  const all = hours.data ?? [];
  const t = totals(list, all);
  const pending = all.filter((h) => !h.approved && list.some((e) => e.id === h.event_id && canWith(me, 'outreach.approve_hours', e.team_id)));
  const current = list.find((e) => e.id === selected) ?? null;
  return (
    <div>
      <ModuleHeader moduleId="outreach" actions={canCreate && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Add outreach event</Button>}>
        <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'events', label: 'Events' }, { value: 'totals', label: 'Totals' }]} />
      </ModuleHeader>
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Volunteer hours" icon={<Clock />} value={t.hours} hint={t.pending ? `+${t.pending} h waiting for approval` : season} />
          <StatTile label="People reached" icon={<Users />} value={t.people.toLocaleString()} />
          <StatTile label="Events" icon={<HeartHandshake />} value={t.events} />
          <StatTile label="Volunteers" value={t.byPerson.size} />
        </div>
        {canApprove && pending.length > 0 && (
          <Banner tone="warning" title={`${pending.length} hour log${pending.length === 1 ? '' : 's'} waiting for approval`}>
            Open the event to approve them.
          </Banner>
        )}
        {events.isLoading ? (
          <Spinner />
        ) : view === 'events' ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <SmartGroupList
              groups={[
                { id: 'upcoming', title: 'Coming up', items: list.filter((e) => e.date >= toDateInput(new Date())).reverse() },
                { id: 'past', title: 'Done', items: list.filter((e) => e.date < toDateInput(new Date())) },
              ]}
              keyOf={(e) => e.id}
              empty={<EmptyState icon={<HeartHandshake />} title={`No outreach logged for ${season}`} body={<ModulePurpose moduleId="outreach" compact className="mt-2 text-left" />} />}
              render={(e) => {
                const hs = all.filter((h) => h.event_id === e.id);
                const waiting = hs.filter((h) => !h.approved).length;
                return (
                  <ListRow onClick={() => setSelected(e.id)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium">{e.title}</p>
                      <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                        <span>{formatDate(e.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        <span>· {e.kind}</span>
                        {e.people_reached != null && <span>· {e.people_reached.toLocaleString()} reached</span>}
                        <TeamBadge teamId={e.team_id} />
                      </p>
                    </div>
                    {waiting > 0 && canApprove && <StatusPill label={`${waiting} to approve`} tone="warning" />}
                    <span className="tabular text-[12.5px] text-muted">{round(hs.filter((h) => h.approved).reduce((n, h) => n + Number(h.hours), 0))} h</span>
                  </ListRow>
                );
              }}
            />
          </div>
        ) : (
          <TotalsView events={list} hours={all} season={season} />
        )}
      </div>
      {(creating || editing) && <EventEditor event={editing} draftTitle={params.get('title')} onClose={() => (setCreating(false), setEditing(null))} />}
      {current && !editing && <EventDialog event={current} hours={all.filter((h) => h.event_id === current.id)} onEdit={() => setEditing(current)} onClose={() => setSelected(null)} />}
    </div>
  );
}

function TotalsView({ events, hours, season }: { events: OutEvent[]; hours: Hours[]; season: string }) {
  const people = usePeople();
  const t = totals(events, hours);
  const kinds = [...t.byKind.entries()].sort((a, b) => b[1].hours - a[1].hours);
  const ranked = [...t.byPerson.entries()].sort((a, b) => b[1] - a[1]);
  const exportCsv = () => {
    const name = (id: string) => people.data?.get(id)?.name ?? 'Former member';
    const rows: (string | number)[][] = [['Event', 'Date', 'Kind', 'Location', 'People reached', 'Person', 'Hours', 'Approved']];
    for (const e of events) {
      const hs = hours.filter((h) => h.event_id === e.id);
      if (!hs.length) rows.push([e.title, e.date, e.kind, e.location ?? '', e.people_reached ?? '', '', '', '']);
      for (const h of hs) rows.push([e.title, e.date, e.kind, e.location ?? '', e.people_reached ?? '', name(h.user_id), Number(h.hours), h.approved ? 'yes' : 'no']);
    }
    downloadText(toCsv(rows), `outreach-${season}.csv`, 'text/csv');
  };
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-[13px] font-semibold">Hours by kind</h2>
        {kinds.length ? <MiniBarChart data={kinds.map(([k, v]) => ({ label: k, value: round(v.hours) }))} format={(n) => `${n} h`} /> : <p className="text-[13px] text-faint">Nothing yet.</p>}
        <table className="mt-3 w-full text-[13px]">
          <thead className="text-left text-[12px] text-faint">
            <tr>
              <th className="font-medium">Kind</th>
              <th className="text-right font-medium">Events</th>
              <th className="text-right font-medium">Hours</th>
              <th className="text-right font-medium">Reached</th>
            </tr>
          </thead>
          <tbody>
            {kinds.map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="tabular text-right">{v.events}</td>
                <td className="tabular text-right">{round(v.hours)}</td>
                <td className="tabular text-right">{v.people.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center">
          <h2 className="flex-1 text-[13px] font-semibold">Hours by person (approved)</h2>
          <Button size="sm" variant="ghost" icon={<Download className="size-4" />} onClick={exportCsv}>
            CSV
          </Button>
        </div>
        <ol className="space-y-1.5 text-[13px]">
          {ranked.map(([id, h]) => {
            const p = people.data?.get(id);
            return (
              <li key={id} className="flex items-center gap-2">
                <Avatar name={p?.name ?? '?'} src={p?.avatarUrl} size={22} />
                <span className="flex-1">{p?.name ?? 'Former member'}</span>
                <span className="tabular text-muted">{round(h)} h</span>
              </li>
            );
          })}
          {!ranked.length && <li className="text-faint">No approved hours yet.</li>}
        </ol>
      </section>
    </div>
  );
}

function EventDialog({ event: e, hours, onEdit, onClose }: { event: OutEvent; hours: Hours[]; onEdit: () => void; onClose: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const people = usePeople();
  const mine = hours.find((h) => h.user_id === me.id);
  const [h, setH] = useState(String(mine?.hours ?? ''));
  const approver = canWith(me, 'outreach.approve_hours', e.team_id);
  const canLog = canWith(me, 'outreach.log_hours', e.team_id);
  const refresh = () => qc.invalidateQueries({ queryKey: ['outreach'] });
  const log = async () => {
    const n = Number(h);
    if (!(n > 0 && n <= 24)) return toast.error('Enter hours between 0.5 and 24');
    const { error } = await sb.from('out_hours').upsert({ event_id: e.id, user_id: me.id, hours: Math.round(n * 10) / 10 });
    if (error) return toast.error(friendlyError(error));
    toast.success(approver ? 'Hours saved' : 'Hours logged — waiting for approval');
    refresh();
  };
  const removeHours = async (user: string) => {
    if (!(await confirm({ title: user === me.id ? 'Remove your hours for this event?' : 'Remove these hours?', confirmLabel: 'Remove', danger: true }))) return;
    const { error } = await sb.from('out_hours').delete().match({ event_id: e.id, user_id: user });
    if (error) return toast.error(friendlyError(error));
    if (user === me.id) setH('');
    refresh();
  };
  const approve = async (user: string, on: boolean) => {
    const { error } = await sb.from('out_hours').update({ approved: on }).match({ event_id: e.id, user_id: user });
    if (error) return toast.error(friendlyError(error));
    refresh();
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={e.title}
      description={`${formatDate(e.date, { weekday: 'long', month: 'long', day: 'numeric' })} · ${e.kind}`}
      size="lg"
      footer={
        (e.created_by === me.id || canWith(me, 'outreach.create_event', e.team_id)) && (
          <>
            {(e.created_by === me.id || approver) && (
              <Button
                variant="ghost"
                className="mr-auto text-danger"
                icon={<Trash2 className="size-4" />}
                onClick={async () => {
                  if (!(await confirm({ title: 'Delete this outreach event?', body: 'Logged hours for it are deleted too.', danger: true, confirmLabel: 'Delete' }))) return;
                  await sb.from('out_events').delete().eq('id', e.id);
                  refresh();
                  onClose();
                }}
              >
                Delete
              </Button>
            )}
            <Button icon={<Pencil className="size-4" />} onClick={onEdit}>
              Edit
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
          {e.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" /> {e.location}
            </span>
          )}
          {e.people_reached != null && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {e.people_reached.toLocaleString()} people reached
            </span>
          )}
        </div>
        {e.description && <p className="whitespace-pre-wrap text-[13.5px]">{e.description}</p>}
        <Slot name="outreach.event.actions" props={{ event: e }} wrap={(c) => <div className="flex flex-wrap gap-2">{c}</div>} />
        {canLog && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-bg-subtle/50 p-3">
            <Field label="Your hours">{(id) => <Input id={id} type="number" step={0.5} min={0.5} max={24} className="w-28" value={h} onChange={(ev) => setH(ev.target.value)} />}</Field>
            <Button variant="primary" onClick={log}>
              {mine ? 'Update' : 'Log hours'}
            </Button>
            {mine && <StatusPill label={mine.approved ? 'Approved' : 'Waiting for approval'} tone={mine.approved ? 'success' : 'warning'} />}
            {mine && (
              <Button variant="ghost" size="sm" className="text-danger" onClick={() => removeHours(me.id)}>
                Remove my hours
              </Button>
            )}
          </div>
        )}
        <section>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">Volunteers</h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {hours.map((x) => {
              const p = people.data?.get(x.user_id);
              return (
                <li key={x.user_id} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                  <Avatar name={p?.name ?? '?'} src={p?.avatarUrl} size={22} />
                  <span className="flex-1">{p?.name ?? 'Former member'}</span>
                  <span className="tabular">{Number(x.hours)} h</span>
                  {approver && x.user_id !== me.id && (
                    <IconButton label={`Remove ${p?.name ?? 'these'} hours`} size="sm" onClick={() => removeHours(x.user_id)}>
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  )}
                  {approver ? (
                    <Button size="sm" variant={x.approved ? 'ghost' : 'secondary'} icon={x.approved ? <Check className="size-4 text-success" /> : undefined} onClick={() => approve(x.user_id, !x.approved)}>
                      {x.approved ? 'Approved' : 'Approve'}
                    </Button>
                  ) : (
                    !x.approved && <StatusPill label="Pending" tone="warning" />
                  )}
                </li>
              );
            })}
            {!hours.length && <li className="px-3 py-2 text-[13px] text-faint">No hours logged yet.</li>}
          </ul>
        </section>
      </div>
    </Dialog>
  );
}

function EventEditor({ event, draftTitle, onClose }: { event: OutEvent | null; draftTitle: string | null; onClose: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const scope = useTeamScope();
  const { kinds } = useModuleSettings<{ kinds: string[] }>('outreach');
  const [v, setV] = useState({
    title: event?.title ?? draftTitle ?? '',
    date: event?.date ?? toDateInput(new Date()),
    kind: event?.kind ?? kinds[0] ?? 'Demo',
    location: event?.location ?? '',
    people_reached: event?.people_reached != null ? String(event.people_reached) : '',
    description: event?.description ?? '',
    team_id: event ? event.team_id : scope,
  });
  const save = async () => {
    if (!v.title.trim()) return toast.error('Give the event a title');
    const body = { title: v.title.trim(), date: v.date, kind: v.kind, location: v.location.trim() || null, people_reached: v.people_reached ? Math.max(0, Math.round(Number(v.people_reached))) : null, description: v.description.trim() || null, team_id: v.team_id };
    const { error } = event ? await sb.from('out_events').update(body).eq('id', event.id) : await sb.from('out_events').insert({ ...body, created_by: me.id });
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['outreach'] });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={event ? 'Edit outreach event' : 'Add outreach event'} size="md" footer={<Button variant="primary" onClick={save}>Save</Button>}>
      <div className="space-y-4">
        <Field label="What">{(id) => <Input id={id} autoFocus maxLength={120} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Library robot demo" />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date">{(id) => <Input id={id} type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />}</Field>
          <Field label="Kind">
            {(id) => (
              <Select id={id} value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
                {[...new Set([...kinds, v.kind])].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Where" optional>{(id) => <Input id={id} maxLength={160} value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} />}</Field>
          <Field label="People reached" optional hint="A fair estimate is fine">{(id) => <Input id={id} type="number" min={0} value={v.people_reached} onChange={(e) => setV({ ...v, people_reached: e.target.value })} />}</Field>
        </div>
        <Field label="What happened" optional hint="Useful later for award submissions and the portfolio">{(id) => <Textarea id={id} rows={3} maxLength={4000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />}</Field>
        <TeamScopePicker value={v.team_id} onChange={(t) => setV({ ...v, team_id: t })} perm="outreach.create_event" />
        <ScopeVisibility teamId={v.team_id} />
      </div>
    </Dialog>
  );
}
