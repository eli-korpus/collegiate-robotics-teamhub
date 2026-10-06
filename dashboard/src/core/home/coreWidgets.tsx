import { useMemo, useState } from 'react';
import { fieldLevel, type FieldLevel } from '@teamhub/config-schema/util';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ClipboardList, Link2, UserPlus } from 'lucide-react';
import { Button, Card, CardHeader, Favicon, Input, RelativeTime, Select, VisibilityNote, buttonClass, hostOf, toast } from '@teamhub/ui';
import {
  friendlyError,
  isMultiTeam,
  runtime,
  canWith,
  useCan,
  TOOL_SLOT_LABELS,
  useSlotLinks,
  useMe,
  usePeople,
  useSettingsRow,
  useSupabase,
  PersonName,
  type ActivityItem,
  type WidgetDef,
} from '@teamhub/sdk';
import { TeamLogo } from '../auth/AuthLayout';

export interface ProfileFieldDef {
  id: string;
  label: string;
  /** `multiselect` keeps several choices as "A, B" (Subteam always allows several). */
  type: 'text' | 'select' | 'multiselect';
  options: string[];
  /** Not "everyone": only some people can see it (see level). */
  private: boolean;
  /** Who can see it: everyone in the program, the team's leaders (captains, mentors) or mentors only. */
  level: FieldLevel;
}

export type { FieldLevel };
export const LEVEL_NOTE: Record<FieldLevel, string> = {
  everyone: 'Visible to your program',
  leaders: 'Only you, your captains and mentors',
  mentors: 'Only you and mentors',
};

/** Config fields + simple fields added later in-app (visible to everyone, spec §12.2). */
export function useProfileFields(): ProfileFieldDef[] {
  const s = useSettingsRow();
  return useMemo(() => {
    const base = runtime().config.profileFields.map((f) => {
      const level = fieldLevel(f);
      return { id: f.id, label: f.label, type: f.type, options: f.options ?? [], level, private: level !== 'everyone' };
    });
    const extra = (s.data?.extra_profile_fields ?? [])
      .filter((f) => !base.some((b) => b.id === f.id))
      .map((f) => ({ ...f, options: f.options ?? [], level: 'everyone' as const, private: false }));
    return [...base, ...extra];
  }, [s.data]);
}

/** Someone's fields that not everyone can see: team-only (leaders) and mentors-only. Empty where you can't see them. */
export interface HiddenValues {
  leaders: Record<string, string>;
  mentors: Record<string, string>;
}
export function useHiddenValues(userId: string) {
  const sb = useSupabase();
  return useQuery({
    queryKey: ['core', 'private', userId],
    queryFn: async (): Promise<HiddenValues> => {
      const [l, p] = await Promise.all([
        sb.from('profiles_leaders').select('data').eq('user_id', userId).maybeSingle(),
        sb.from('profiles_private').select('data').eq('user_id', userId).maybeSingle(),
      ]);
      return { leaders: (l.data?.data ?? {}) as Record<string, string>, mentors: (p.data?.data ?? {}) as Record<string, string> };
    },
  });
}
export const useMyPrivate = () => useHiddenValues(useMe().id);

/** A field's value from wherever its level keeps it. */
export function fieldValue(f: ProfileFieldDef, details: Record<string, string> | null | undefined, hidden: HiddenValues | null | undefined): string {
  return (f.level === 'everyone' ? details?.[f.id] : f.level === 'leaders' ? hidden?.leaders[f.id] : hidden?.mentors[f.id]) ?? '';
}

/** Whether the viewer can see (and edit) this level of someone's profile: same rules as the database. */
export function canSeeLevel(me: ReturnType<typeof useMe>, level: FieldLevel, person: { id: string; memberships: { team_id: string }[] }): boolean {
  if (level === 'everyone' || person.id === me.id || me.isAdmin) return true;
  const perm = level === 'leaders' ? 'people.view_team_info' : 'people.view_private';
  return person.memberships.some((m) => canWith(me, perm, m.team_id));
}

/** Saves profile field values to the right place for each field's level, merging with existing values. */
export async function saveProfileFields(
  sb: ReturnType<typeof useSupabase>,
  userId: string,
  fields: ProfileFieldDef[],
  values: Record<string, string>,
  current: { details: Record<string, string>; hidden: HiddenValues },
) {
  const by: Record<FieldLevel, Record<string, string>> = { everyone: {}, leaders: {}, mentors: {} };
  for (const [k, v] of Object.entries(values)) {
    const f = fields.find((x) => x.id === k);
    if (f) by[f.level][k] = v;
  }
  if (Object.keys(by.everyone).length) {
    const { error } = await sb.from('profiles').update({ details: { ...current.details, ...by.everyone } }).eq('id', userId);
    if (error) throw error;
  }
  if (Object.keys(by.leaders).length) {
    const { error } = await sb.from('profiles_leaders').upsert({ user_id: userId, data: { ...current.hidden.leaders, ...by.leaders } });
    if (error) throw error;
  }
  if (Object.keys(by.mentors).length) {
    const { error } = await sb.from('profiles_private').upsert({ user_id: userId, data: { ...current.hidden.mentors, ...by.mentors } });
    if (error) throw error;
  }
}

/** "Build, CAD" → ["Build", "CAD"]: how multi-choice profile answers are stored. */
export const splitChoices = (v: string | null | undefined): string[] =>
  String(v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** People can be on several subteams, so Subteam is multi-choice even in older configs that say "select". */
export const isMultiChoice = (f: Pick<ProfileFieldDef, 'id' | 'type'>) => f.type === 'multiselect' || f.id === 'subteam';

export function ProfileFieldInput({ field, value, onChange }: { field: ProfileFieldDef; value: string; onChange: (v: string) => void }) {
  if (isMultiChoice(field) && field.options.length) {
    const picked = splitChoices(value);
    return (
      <div role="group" aria-label={field.label} className="flex flex-wrap gap-1.5">
        {field.options.map((o) => {
          const on = picked.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange((on ? picked.filter((x) => x !== o) : [...picked, o]).join(', '))}
              className={on ? 'h-8 rounded-full border border-accent bg-accent-soft px-3 text-[13px] font-medium' : 'h-8 rounded-full border border-border px-3 text-[13px] text-muted hover:bg-bg-subtle'}
            >
              {o}
            </button>
          );
        })}
      </div>
    );
  }
  return field.type === 'select' ? (
    <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={field.label}>
      <option value="">Choose…</option>
      {field.options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </Select>
  ) : (
    <Input value={value} onChange={(e) => onChange(e.target.value)} aria-label={field.label} maxLength={200} />
  );
}

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
function RequestInfoCards() {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const fields = useProfileFields();
  const priv = useMyPrivate();
  const reqs = useQuery({
    queryKey: ['core', 'info-requests'],
    queryFn: async () => {
      const { data, error } = await sb.from('info_requests').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as { id: string; fields: string[]; team_id: string | null; message: string | null; created_by: string; closes_at: string | null }[];
    },
  });
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const myTeams = new Set(me.memberships.filter((m) => m.status === 'active').map((m) => m.team_id));
  const has = (id: string) => { const f = fields.find((x) => x.id === id); return !!(f ? fieldValue(f, me.profile.details, priv.data) : me.profile.details?.[id]); };
  const open = (reqs.data ?? []).filter(
    (r) => (!r.closes_at || new Date(r.closes_at) > new Date()) && (!r.team_id || myTeams.has(r.team_id)) && r.fields.some((f) => !has(f)),
  );
  if (!open.length || priv.isLoading) return null;
  const missing = [...new Set(open.flatMap((r) => r.fields.filter((f) => !has(f))))].map((id) => fields.find((f) => f.id === id)).filter(Boolean) as ProfileFieldDef[];
  if (!missing.length) return null;
  return (
    <Card className="border-warning/40">
      <CardHeader icon={<ClipboardList className="size-4" />} title={`Please add your ${missing.map((f) => f.label.toLowerCase()).join(', ')}`} subtitle={open[0].message ? `“${open[0].message}” · ` : undefined} />
      <form
        className="space-y-2.5 px-4 pb-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await saveProfileFields(sb, me.id, fields, values, { details: me.profile.details ?? {}, hidden: priv.data ?? { leaders: {}, mentors: {} } });
            toast.success('Saved to your profile');
            qc.invalidateQueries({ queryKey: ['core'] });
          } catch (err) {
            toast.error(friendlyError(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        {missing.map((f) => (
          <div key={f.id} role="group" aria-label={f.label} className="space-y-1">
            <p className="text-[12.5px] font-medium">{f.label}</p>
            <ProfileFieldInput field={f} value={values[f.id] ?? ''} onChange={(v) => setValues({ ...values, [f.id]: v })} />
            <VisibilityNote locked={f.private}>{f.private ? 'Private: only you and mentors can see this' : 'Saved to your profile, visible to your team'}</VisibilityNote>
          </div>
        ))}
        <p className="text-[12px] text-muted">
          Requested by <PersonName id={open[0].created_by} />
        </p>
        <Button type="submit" size="sm" variant="primary" loading={busy}>
          Save to my profile
        </Button>
      </form>
    </Card>
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
              <a href={l.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-bg-subtle">
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
