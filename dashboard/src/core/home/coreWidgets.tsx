import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Activity, Link2, UserPlus } from 'lucide-react';
import { Card, CardHeader, Favicon, RelativeTime, buttonClass, hostOf, safeHref } from '@teamhub/ui';
import {
  isMultiTeam,
  runtime,
  useCan,
  TOOL_SLOT_LABELS,
  useSlotLinks,
  useMe,
  usePeople,
  useSupabase,
  PersonName,
  type ActivityItem,
  type WidgetDef,
} from '@teamhub/sdk';
import { TeamLogo } from '../auth/AuthLayout';
import type { InfoRequest } from '../people/profileFields';

// ── Pending approvals (approvers) ──────────────────────────────────────────
function Approvals() {
  const people = usePeople();
  const me = useMe();
  const pending = [...(people.data?.values() ?? [])].filter((p) => p.id !== me.id && p.memberships.some((m) => m.status === 'pending'));
  if (!pending.length) return null;
  return (
    <Card className="border-accent/30">
      <CardHeader icon={<UserPlus className="size-4" />} title={`${pending.length} ${pending.length === 1 ? 'person wants' : 'people want'} to join`} />
      <div className="px-4 pb-3">
        <p className="text-[12.5px] text-muted">{pending.slice(0, 3).map((p) => p.name).join(', ')}{pending.length > 3 ? '…' : ''}</p>
        <Link to="/people?tab=requests" className={buttonClass('primary', 'sm', 'mt-2')}>
          Review requests
        </Link>
      </div>
    </Card>
  );
}

// ── Request info cards (spec §12.2) ────────────────────────────────────────
const RequestInfoForm = lazy(() => import('../people/profileFields').then((m) => ({ default: m.RequestInfoForm })));
function RequestInfoCards() {
  const sb = useSupabase();
  const me = useMe();
  const reqs = useQuery({
    queryKey: ['core', 'info-requests'],
    queryFn: async () => {
      const { data, error } = await sb.from('info_requests').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as InfoRequest[];
    },
  });
  const myTeams = new Set(me.memberships.filter((m) => m.status === 'active').map((m) => m.team_id));
  const open = (reqs.data ?? []).filter((r) => (!r.closes_at || new Date(r.closes_at) > new Date()) && (!r.team_id || myTeams.has(r.team_id)));
  if (!open.length) return null;
  return (
    <Suspense fallback={null}>
      <RequestInfoForm requests={open} />
    </Suspense>
  );
}

// ── Team info ──────────────────────────────────────────────────────────────
function TeamInfo() {
  const c = runtime().config;
  const me = useMe();
  const mine = c.teams.filter((t) => me.memberships.some((m) => m.team_id === t.id && m.status === 'active'));
  const teams = mine.length ? mine : c.teams;
  return (
    <Card>
      <CardHeader title={isMultiTeam() ? 'Your teams' : 'Your team'} />
      <ul className="space-y-2 px-4 pb-4">
        {teams.map((t) => {
          const m = me.memberships.find((x) => x.team_id === t.id);
          return (
            <li key={t.id} className="flex items-center gap-3">
              <TeamLogo teamId={t.id} size={36} />
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold">{t.name}</p>
                <p className="text-[12px] text-muted">
                  {t.number ? `FTC #${t.number}` : 'FTC team'}
                  {m && ` · you're a ${m.type}`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ── Quick links ────────────────────────────────────────────────────────────
function QuickLinks() {
  const pinned = useSlotLinks(Object.keys(TOOL_SLOT_LABELS)).slice(0, 10);
  const canEdit = useCan('core.edit_links');
  return (
    <Card>
      <CardHeader icon={<Link2 className="size-4" />} title="Team tools" action={canEdit ? <Link to="/admin/links" className="text-[12px] font-medium text-accent">Edit</Link> : undefined} />
      {pinned.length ? (
        <ul className="grid grid-cols-1 gap-0.5 px-2 pb-3">
          {pinned.map((l) => (
            <li key={l.id}>
              <a href={safeHref(l.url)} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-bg-subtle">
                <Favicon url={l.url} size={16} />
                <span className="min-w-0 flex-1 truncate font-medium">{l.label}</span>
                <span className="truncate text-[11.5px] text-faint">{hostOf(l.url)}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-4 text-[12.5px] text-faint">No tool links yet.</p>
      )}
    </Card>
  );
}

// ── Recent activity (no activity table: composed from modules, spec §10.3) ─
function RecentActivity() {
  const sb = useSupabase();
  const providers = runtime().modules.filter((m) => m.client.activity);
  const q = useQuery({
    queryKey: ['core', 'activity', providers.map((p) => p.manifest.id)],
    enabled: providers.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const all = await Promise.all(providers.map((p) => p.client.activity!(sb, 8).catch(() => [] as ActivityItem[])));
      return all
        .flat()
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 12);
    },
  });
  if (!providers.length) return null;
  return (
    <Card>
      <CardHeader icon={<Activity className="size-4" />} title="Recent activity" />
      {q.data?.length ? (
        <ul className="divide-y divide-border px-1 pb-2">
          {q.data.map((a) => (
            <li key={a.id}>
              <Link to={a.href} className="flex items-baseline gap-2 rounded-md px-3 py-2 text-[13px] hover:bg-bg-subtle">
                <span className="min-w-0 flex-1">
                  {a.actor && (
                    <strong className="font-medium">
                      <PersonName id={a.actor} />{' '}
                    </strong>
                  )}
                  <span className="text-muted">{a.text}</span>
                </span>
                <RelativeTime date={a.at} className="shrink-0 text-[11.5px] text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-4 text-[12.5px] text-faint">Nothing yet: activity from your tabs shows up here.</p>
      )}
    </Card>
  );
}

export const CORE_WIDGETS: (WidgetDef & { module: 'core' })[] = [
  { id: 'approvals', title: 'Join requests', priority: 'today', component: Approvals, perm: 'people.approve_members', module: 'core' },
  { id: 'request-info', title: 'Info requested from you', priority: 'today', component: RequestInfoCards, module: 'core' },
  { id: 'team', title: 'Team info', component: TeamInfo, module: 'core' },
  { id: 'links', title: 'Team tools', component: QuickLinks, module: 'core' },
  { id: 'activity', title: 'Recent activity', size: 'lg', component: RecentActivity, module: 'core' },
];
