import { useMemo, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, Play, QrCode, UserCheck, XCircle } from 'lucide-react';
import {
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  Input,
  ListRow,
  ProgressRing,
  Segmented,
  SmartGroupList,
  Spinner,
  StatTile,
  StatusPill,
  VisibilityNote,
  daysBetween,
  downloadText,
  formatDate,
  parseDate,
  toCsv,
  toDateInput,
  toast,
} from '@teamhub/ui';
import {
  friendlyError,
  ModuleHeader,
  Slot,
  hasSlot,
  TeamBadge,
  TeamScopePicker,
  useActivePeople,
  useCan,
  useCreateShortcut,
  useMe,
  usePeople,
  useSeason,
  useSupabase,
  useTeamScope,
} from '@teamhub/sdk';
import { hours, sessionTitle, statsFor, useAttSettings, usePresence, useSeasonSessions, type Session } from '../data';
import { SessionPage } from './SessionPage';
import { CodeScreen } from './CodeScreen';
import { CheckIn } from './CheckIn';

export default function AttendanceRoutes() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="session/:id" element={<SessionPage />} />
      <Route path="session/:id/code" element={<CodeScreen />} />
      <Route path="check-in" element={<CheckIn />} />
    </Routes>
  );
}

type Tab = 'me' | 'sessions' | 'report';

function Overview() {
  const canTake = useCan('attendance.take');
  const canViewAll = useCan('attendance.view_all');
  const settings = useAttSettings();
  const [tab, setTab] = useState<Tab>(canTake || canViewAll ? 'sessions' : 'me');
  const [starting, setStarting] = useState(false);
  const nav = useNavigate();
  // With the Calendar tab, attendance is always taken for a calendar event (no separate practices).
  const fromCalendar = hasSlot('attendance.picker');
  useCreateShortcut(() => setStarting(true), canTake);
  return (
    <div>
      <ModuleHeader
        moduleId="attendance"
        actions={
          <>
            {settings.selfCheckIn && (
              <Button size="sm" variant="ghost" icon={<QrCode className="size-4" />} onClick={() => nav('/attendance/check-in')}>
                Check in
              </Button>
            )}
            {canTake && (
              <Button variant="primary" icon={<Play className="size-4" />} onClick={() => setStarting(true)}>
                {fromCalendar ? 'Take attendance' : 'Start a practice'}
              </Button>
            )}
          </>
        }
      >
        <Segmented
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'me' as Tab, label: 'My attendance' },
            ...(canTake || canViewAll ? [{ value: 'sessions' as Tab, label: 'Sessions' }] : []),
            ...(canViewAll ? [{ value: 'report' as Tab, label: 'Team report' }] : []),
          ]}
        />
      </ModuleHeader>
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        {canTake && <Slot name="attendance.start" props={{}} wrap={(c) => <div className="mb-4">{c}</div>} />}
        {tab === 'me' && <Mine />}
        {tab === 'sessions' && <SessionsList />}
        {tab === 'report' && <Report />}
      </div>
      {starting && (fromCalendar ? <Slot name="attendance.picker" props={{ onClose: () => setStarting(false) }} /> : <StartDialog onClose={() => setStarting(false)} />)}
    </div>
  );
}

export function StartDialog({ onClose, initial }: { onClose: () => void; initial?: { title?: string; date?: string; teamId?: string | null } }) {
  const sb = useSupabase();
  const me = useMe();
  const scope = useTeamScope();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState(initial?.title ?? 'Practice');
  const [date, setDate] = useState(initial?.date ?? toDateInput(new Date()));
  const [teamId, setTeamId] = useState<string | null>(initial?.teamId ?? scope);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title="Start a practice"
      footer={
        <Button
          variant="primary"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const { data, error } = await sb
              .from('att_sessions')
              .insert({ title: title.trim() || null, date, team_id: teamId, starts_at: date === toDateInput(new Date()) ? new Date().toISOString() : null, created_by: me.id })
              .select('id')
              .single();
            setBusy(false);
            if (error) return toast.error(friendlyError(error));
            qc.invalidateQueries({ queryKey: ['attendance'] });
            nav(`/attendance/session/${data.id}`);
          }}
        >
          Start taking attendance
        </Button>
      }
    >
      <div className="space-y-3">
        <Field label="Name" required>{(id) => <Input id={id} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Field label="Date" required>{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <TeamScopePicker value={teamId} onChange={setTeamId} perm="attendance.take" label="Who's expected" />
      </div>
    </Dialog>
  );
}

function Mine() {
  const me = useMe();
  const people = usePeople();
  const sessions = useSeasonSessions();
  const presence = usePresence(sessions.data?.map((s) => s.id), me.id);
  const settings = useAttSettings();
  const season = useSeason();
  const person = people.data?.get(me.id);
  if (sessions.isLoading || presence.isLoading || !person) return <Spinner />;
  const st = statsFor(person, sessions.data ?? [], presence.data ?? [], settings.includeMentors || me.memberships.every((m) => m.type === 'mentor'));
  const attended = new Set((presence.data ?? []).map((p) => p.session_id));
  const today = toDateInput(new Date());
  const past = (sessions.data ?? []).filter((s) => s.date <= today);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-4">
          <ProgressRing value={st.pct ?? 0} size={64} label="Your attendance this season">
            {st.pct == null ? '–' : `${Math.round(st.pct * 100)}%`}
          </ProgressRing>
          <div>
            <p className="font-semibold">Season {season}</p>
            <p className="text-[12.5px] text-muted">
              {st.attended} of {st.expected} practices
            </p>
          </div>
        </Card>
        {settings.trackHours && <StatTile label="Hours this season" value={hours(st.hoursMs)} />}
      </div>
      <VisibilityNote>Your attendance is visible to you and to the captains and mentors who take attendance.</VisibilityNote>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {past.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-[13.5px]">
            {attended.has(s.id) ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-faint" />}
            <span className="flex-1">{sessionTitle(s)}</span>
            <TeamBadge teamId={s.team_id} />
            <span className="tabular text-muted">{formatDate(s.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </li>
        ))}
        {!past.length && <li className="px-4 py-6 text-center text-[13px] text-faint">No practices recorded yet this season.</li>}
      </ul>
    </div>
  );
}

function SessionsList() {
  const sessions = useSeasonSessions();
  const scope = useTeamScope();
  const nav = useNavigate();
  const presence = usePresence(sessions.data?.map((s) => s.id));
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of presence.data ?? []) m.set(p.session_id, (m.get(p.session_id) ?? 0) + 1);
    return m;
  }, [presence.data]);
  if (sessions.isLoading) return <Spinner />;
  const list = (sessions.data ?? []).filter((s) => !scope || !s.team_id || s.team_id === scope);
  const now = new Date();
  const groups = [
    { id: 'today', title: 'Today', items: list.filter((s) => daysBetween(now, parseDate(s.date)) === 0) },
    { id: 'upcoming', title: 'Upcoming', items: list.filter((s) => daysBetween(now, parseDate(s.date)) > 0).reverse() },
    { id: 'week', title: 'This week', items: list.filter((s) => { const d = daysBetween(now, parseDate(s.date)); return d < 0 && d >= -7; }) },
    { id: 'earlier', title: 'Earlier', items: list.filter((s) => daysBetween(now, parseDate(s.date)) < -7) },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <SmartGroupList<Session>
        groups={groups}
        keyOf={(s) => s.id}
        empty={<EmptyState icon={<UserCheck />} title="No practices yet" body="Start a practice to take attendance." />}
        render={(s) => (
          <ListRow onClick={() => nav(`/attendance/session/${s.id}`)}>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium">{sessionTitle(s)}</p>
              <p className="text-[12px] text-muted">
                {formatDate(s.date, { weekday: 'long', month: 'short', day: 'numeric' })} <TeamBadge teamId={s.team_id} />
              </p>
            </div>
            <span className="tabular text-[13px] text-muted">{counts.get(s.id) ?? 0} present</span>
            <StatusPill label={s.closed ? 'Closed' : 'Open'} tone={s.closed ? 'neutral' : 'success'} />
          </ListRow>
        )}
      />
    </div>
  );
}

function Report() {
  const sessions = useSeasonSessions();
  const presence = usePresence(sessions.data?.map((s) => s.id));
  const scope = useTeamScope();
  const people = useActivePeople(scope);
  const settings = useAttSettings();
  const season = useSeason();
  const nav = useNavigate();
  const rows = useMemo(
    () =>
      people
        .map((p) => ({ p, st: statsFor(p, sessions.data ?? [], presence.data ?? [], settings.includeMentors) }))
        .filter((r) => r.st.expected > 0),
    [people, sessions.data, presence.data, settings.includeMentors],
  );
  if (sessions.isLoading || presence.isLoading) return <Spinner />;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted">
          Season {season} · {sessions.data?.length ?? 0} sessions
        </p>
        <Button
          size="sm"
          icon={<Download className="size-4" />}
          onClick={() =>
            downloadText(
              toCsv([
                ['Name', 'Attended', 'Expected', 'Percent', ...(settings.trackHours ? ['Hours'] : [])],
                ...rows.map((r) => [r.p.name, r.st.attended, r.st.expected, r.st.pct == null ? '' : Math.round(r.st.pct * 100), ...(settings.trackHours ? [hours(r.st.hoursMs)] : [])]),
              ]),
              `attendance-${season}.csv`,
              'text/csv',
            )
          }
        >
          Export CSV
        </Button>
      </div>
      <DataTable
        rows={rows}
        keyOf={(r) => r.p.id}
        empty={<EmptyState title="No data yet" />}
        columns={[
          { id: 'name', header: 'Name', cell: (r) => <button className="font-medium hover:underline" onClick={() => nav(`/people/${r.p.id}`)}>{r.p.name}</button>, sort: (r) => r.p.name },
          { id: 'att', header: 'Attended', align: 'right', cell: (r) => `${r.st.attended}/${r.st.expected}`, sort: (r) => r.st.attended },
          {
            id: 'pct',
            header: '%',
            align: 'right',
            sort: (r) => r.st.pct ?? -1,
            cell: (r) => <span className={r.st.pct != null && r.st.pct < 0.6 ? 'text-danger' : r.st.pct != null && r.st.pct < 0.8 ? 'text-warning' : ''}>{r.st.pct == null ? '–' : `${Math.round(r.st.pct * 100)}%`}</span>,
          },
          ...(settings.trackHours ? [{ id: 'h', header: 'Hours', align: 'right' as const, cell: (r: (typeof rows)[number]) => hours(r.st.hoursMs), sort: (r: (typeof rows)[number]) => r.st.hoursMs }] : []),
        ]}
      />
    </div>
  );
}
