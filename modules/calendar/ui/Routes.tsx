import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock, Copy, MapPin, Pencil, Repeat, RotateCw, Rss, Trash2, XCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Calendar,
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Markdown,
  calendarRange,
  cn,
  formatDate,
  formatTime,
  toast,
  useConfirm,
  useMediaQuery,
  type CalendarItem,
  type CalendarView,
} from '@teamhub/ui';
import {
  canWith,
  friendlyError,
  isMultiTeam,
  ModuleHeader,
  ModuleNewMenu,
  Person,
  runtime,
  Slot,
  TeamBadge,
  useCan,
  useCreateShortcut,
  useMe,
  useModuleSettings,
  useNewParam,
  useSelectedParam,
  useSupabase,
  useTeamScope,
} from '@teamhub/sdk';
import { KINDS, type Kind } from '../kinds';
import { describeRule, parseRule } from '../rrule';
import { useCalendarData, type Occurrence } from '../data';
import { EventDialog, type EventDraft } from './EventDialog';

export default function CalendarRoutes() {
  const settings = useModuleSettings<{ defaultView: CalendarView }>('calendar');
  const phone = !useMediaQuery('(min-width: 768px)');
  const [view, setView] = useState<CalendarView>(phone ? 'agenda' : settings.defaultView ?? 'month');
  const [cursor, setCursor] = useState(new Date());
  const [hidden, setHidden] = useState<Set<Kind>>(new Set());
  const teamId = useTeamScope();
  const { from, to } = calendarRange(view, cursor);
  const data = useCalendarData(from, to, teamId);
  const [creating, setCreating, params] = useNewParam();
  const [draft, setDraft] = useState<EventDraft | undefined>();
  const [selected, setSelected] = useSelectedParam('event');
  const [feeds, setFeeds] = useState(false);
  const canCreate = useCan('calendar.create');
  const me = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  useCreateShortcut(() => setCreating(true), canCreate);

  const items: CalendarItem[] = useMemo(
    () => [
      ...data.occurrences
        .filter((o) => !hidden.has(o.event.kind))
        .map((o) => {
          const K = KINDS[o.event.kind];
          const team = isMultiTeam() && o.event.team_id ? runtime().config.teams.find((t) => t.id === o.event.team_id)?.name : undefined;
          return {
            id: o.key,
            title: o.title,
            start: o.start,
            end: o.end,
            allDay: o.event.all_day,
            color: K.color,
            icon: <K.Icon />,
            meta: [o.location, team].filter(Boolean).join(' · ') || undefined,
            cancelled: o.cancelled,
          };
        }),
      ...data.overlays.map((o) => ({ ...o, id: `ov:${o.id}`, overlay: true })),
    ],
    [data.occurrences, data.overlays, hidden],
  );

  const occ = data.occurrences.find((o) => o.key === selected) ?? null;
  const refresh = () => qc.invalidateQueries({ queryKey: ['calendar'] });

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        moduleId="calendar"
        actions={
          <>
            {me.isAdmin && (
              <Button size="sm" variant="ghost" icon={<Rss className="size-4" />} onClick={() => setFeeds(true)}>
                Family feeds
              </Button>
            )}
            {canCreate && (
              <ModuleNewMenu
                moduleId="calendar"
                label="New event"
                onNew={() => {
                  setDraft(undefined);
                  setCreating(true);
                }}
              />
            )}
          </>
        }
      >
        <div className="flex flex-wrap gap-1" role="group" aria-label="Show kinds">
          {(Object.keys(KINDS) as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={!hidden.has(k)}
              onClick={() => {
                const n = new Set(hidden);
                if (n.has(k)) n.delete(k);
                else n.add(k);
                setHidden(n);
              }}
              className={cn('inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium', hidden.has(k) ? 'border-border text-faint' : 'border-transparent bg-bg-subtle text-fg')}
            >
              <span className="size-2 rounded-full" style={{ background: hidden.has(k) ? 'var(--border-strong)' : KINDS[k].color }} />
              {KINDS[k].label}
            </button>
          ))}
        </div>
      </ModuleHeader>
      <div className="min-h-0 flex-1">
        {data.error ? (
          <ErrorState error={data.error} retry={() => data.refetch()} />
        ) : !data.isLoading && !items.length && view !== 'agenda' && !canCreate ? (
          <EmptyState icon={<CalendarDays />} title="Nothing scheduled yet" body="Captains and mentors add practices and events here." />
        ) : (
          <Calendar
            view={view}
            onViewChange={setView}
            cursor={cursor}
            onCursorChange={setCursor}
            items={items}
            onItemClick={(it) => {
              if (it.id.startsWith('ov:')) {
                const ov = data.overlays.find((o) => `ov:${o.id}` === it.id);
                if (ov) nav(ov.href);
              } else setSelected(it.id);
            }}
            onDayClick={
              canCreate && view === 'month'
                ? (d) => {
                    setDraft({ date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` });
                    setCreating(true);
                  }
                : undefined
            }
          />
        )}
      </div>

      {creating && (
        <EventDialog
          open
          onClose={() => setCreating(false)}
          draft={draft ?? { title: params.get('title') ?? undefined, kind: (params.get('kind') as Kind) ?? undefined, date: params.get('date') ?? undefined }}
          onSaved={refresh}
        />
      )}
      {occ && <EventDetail occ={occ} onClose={() => setSelected(null)} onChanged={refresh} />}
      {feeds && <FeedsDialog onClose={() => setFeeds(false)} />}
    </div>
  );
}

function EventDetail({ occ, onClose, onChanged }: { occ: Occurrence; onClose: () => void; onChanged: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const e = occ.event;
  const K = KINDS[e.kind];
  const canEdit = (e.created_by === me.id && canWith(me, 'calendar.create', e.team_id)) || canWith(me, 'calendar.edit_any', e.team_id);
  const when = e.all_day
    ? formatDate(occ.start, { weekday: 'long', month: 'long', day: 'numeric' }) + (occ.end && occ.end > occ.start ? ` – ${formatDate(occ.end, { month: 'long', day: 'numeric' })}` : '')
    : `${formatDate(occ.start, { weekday: 'long', month: 'long', day: 'numeric' })} · ${formatTime(occ.start)}${occ.end ? ` – ${formatTime(occ.end)}` : ''}`;

  const remove = async (scope: 'one' | 'all') => {
    const res =
      scope === 'one'
        ? await sb.from('cal_exceptions').upsert({ event_id: e.id, occurrence_date: occ.date, cancelled: true })
        : await sb.from('cal_events').delete().eq('id', e.id);
    if (res.error) return toast.error(friendlyError(res.error));
    toast.success(scope === 'one' ? 'This date was cancelled' : 'Event deleted');
    onChanged();
    onClose();
  };

  if (editing) return <EventDialog open event={e} onClose={() => setEditing(false)} onSaved={onChanged} />;

  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={
        <span className={cn('flex items-center gap-2', occ.cancelled && 'line-through')}>
          <K.Icon className="size-4" style={{ color: K.color }} /> {occ.title}
        </span>
      }
      footer={
        canEdit ? (
          <>
            {occ.recurring ? (
              <>
                {!occ.cancelled && (
                  <Button
                    variant="ghost"
                    icon={<XCircle className="size-4" />}
                    onClick={async () => {
                      if (await confirm({ title: `Cancel ${formatDate(occ.start)} only?`, body: 'The rest of the series stays.', confirmLabel: 'Cancel this date' })) remove('one');
                    }}
                  >
                    Cancel this date
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="text-danger"
                  icon={<Trash2 className="size-4" />}
                  onClick={async () => {
                    if (await confirm({ title: 'Delete the whole series?', danger: true, confirmLabel: 'Delete series' })) remove('all');
                  }}
                >
                  Delete series
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                className="text-danger"
                icon={<Trash2 className="size-4" />}
                onClick={async () => {
                  if (await confirm({ title: 'Delete this event?', danger: true, confirmLabel: 'Delete' })) remove('all');
                }}
              >
                Delete
              </Button>
            )}
            <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
              Edit{occ.recurring ? ' series' : ''}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-3 text-[13.5px]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{K.label}</Badge>
          <TeamBadge teamId={e.team_id} />
          {occ.cancelled && <Badge tone="danger">Cancelled</Badge>}
        </div>
        <p className="flex items-center gap-2">
          <Clock className="size-4 text-muted" /> {when}
        </p>
        {occ.recurring && (
          <p className="flex items-center gap-2 text-muted">
            <Repeat className="size-4" /> {describeRule(parseRule(e.recurrence))}
          </p>
        )}
        {occ.location && (
          <p className="flex items-center gap-2">
            <MapPin className="size-4 text-muted" />
            <a className="text-accent hover:underline" href={`https://maps.google.com/?q=${encodeURIComponent(occ.location)}`} target="_blank" rel="noreferrer">
              {occ.location}
            </a>
          </p>
        )}
        {e.notes && <Markdown source={e.notes} className="rounded-md bg-bg-subtle p-3 text-[13.5px]" />}
        {e.event_code && <p className="text-[12.5px] text-muted">FTC event code: {e.event_code}</p>}
        <Slot name="calendar.event.actions" props={{ event: e, occurrence: occ }} wrap={(c) => <div className="flex flex-wrap gap-2 border-t border-border pt-3">{c}</div>} />
        <p className="text-[12px] text-faint">
          Added by <Person id={e.created_by} size="sm" />
        </p>
      </div>
    </Dialog>
  );
}

/** Secret iCal links so families can subscribe without accounts (spec §13.2, decision #7). Admin-only. */
function FeedsDialog({ onClose }: { onClose: () => void }) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const teams = runtime().config.teams;
  const base = `${runtime().config.supabase.url}/functions/v1/ical?token=`;
  const q = useQuery({
    queryKey: ['calendar', 'feeds'],
    queryFn: async () => {
      const { data, error } = await sb.from('cal_feeds').select('*');
      if (error) throw error;
      return data as { id: string; team_id: string | null; token: string }[];
    },
  });
  const rows = [{ team_id: null as string | null, name: `Everything in ${runtime().config.program.name}` }, ...(isMultiTeam() ? teams.map((t) => ({ team_id: t.id as string | null, name: t.name })) : [])];
  const refresh = () => qc.invalidateQueries({ queryKey: ['calendar', 'feeds'] });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title="Family calendar feeds" description="Parents can subscribe to these links in Google Calendar, Apple Calendar or Outlook — no account needed. Anyone with a link can see those events, so share them only with families. Rotate a link to turn the old one off." size="lg">
      <ul className="space-y-3">
        {rows.map((r) => {
          const feed = q.data?.find((f) => f.team_id === r.team_id);
          const url = feed ? base + feed.token : null;
          return (
            <li key={r.team_id ?? 'program'} className="rounded-md border border-border p-3">
              <p className="mb-2 text-[13.5px] font-medium">{r.name}</p>
              {url ? (
                <div className="flex gap-2">
                  <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={`${r.name} feed link`} className="text-[12px]" />
                  <IconButton
                    label="Copy link"
                    variant="secondary"
                    onClick={async () => {
                      await navigator.clipboard.writeText(url);
                      toast.success('Copied');
                    }}
                  >
                    <Copy className="size-4" />
                  </IconButton>
                  <IconButton
                    label="Rotate link"
                    variant="secondary"
                    onClick={async () => {
                      if (!(await confirm({ title: 'Rotate this link?', body: 'The old link stops working. Families will need the new one.', confirmLabel: 'Rotate' }))) return;
                      const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
                      const { error } = await sb.from('cal_feeds').update({ token }).eq('id', feed!.id);
                      if (error) toast.error(friendlyError(error));
                      refresh();
                    }}
                  >
                    <RotateCw className="size-4" />
                  </IconButton>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={async () => {
                    const { error } = await sb.from('cal_feeds').insert({ team_id: r.team_id });
                    if (error) toast.error(friendlyError(error));
                    refresh();
                  }}
                >
                  Create link
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
