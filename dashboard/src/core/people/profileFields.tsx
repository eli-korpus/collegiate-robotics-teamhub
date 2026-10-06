import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { asksRoles, fieldLevel, type FieldLevel } from '@teamhub/config-schema/util';
import { Button, Card, CardHeader, Input, Select, VisibilityNote, toast } from '@teamhub/ui';
import { canWith, friendlyError, PersonName, runtime, useMe, useSettingsRow, useSupabase } from '@teamhub/sdk';

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
  /** Who is asked to fill it in (empty = everyone). */
  askTypes: string[];
}

/** Someone's roles on their active teams (member, captain, mentor). */
export const rolesOf = (person: { memberships: { type: string; status?: string }[] }) => [...new Set(person.memberships.filter((m) => !m.status || m.status === 'active').map((m) => m.type))];
/** Fields this person is asked to fill in. */
export const askedFields = (fields: ProfileFieldDef[], person: { memberships: { type: string; status?: string }[] }) => fields.filter((f) => asksRoles(f, rolesOf(person)));

export type { FieldLevel };
export const LEVEL_NOTE: Record<FieldLevel, string> = {
  everyone: 'Visible to your program',
  leaders: 'Only you, your captains and mentors',
  mentors: 'Only you and mentors',
};

/** Config fields + simple fields added later in-app (Admin > Profile fields). */
export function useProfileFields(): ProfileFieldDef[] {
  const s = useSettingsRow();
  return useMemo(() => {
    const base = runtime().config.profileFields.map((f) => {
      const level = fieldLevel(f);
      return { id: f.id, label: f.label, type: f.type, options: f.options ?? [], level, private: level !== 'everyone', askTypes: f.askTypes ?? [] };
    });
    const extra = (s.data?.extra_profile_fields ?? [])
      .filter((f) => !base.some((b) => b.id === f.id))
      .map((f) => {
        const level = fieldLevel(f);
        return { id: f.id, label: f.label, type: f.type, options: f.options ?? [], level, private: level !== 'everyone', askTypes: f.askTypes ?? [] };
      });
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

// ── Request info cards (spec §12.2): Home loads this only when a request is open ──
export interface InfoRequest {
  id: string;
  fields: string[];
  team_id: string | null;
  message: string | null;
  created_by: string;
  closes_at: string | null;
}
export function RequestInfoForm({ requests }: { requests: InfoRequest[] }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const fields = useProfileFields();
  const priv = useMyPrivate();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const has = (id: string) => {
    const f = fields.find((x) => x.id === id);
    return !!(f ? fieldValue(f, me.profile.details, priv.data) : me.profile.details?.[id]);
  };
  // Only fields this person is asked for (mentors aren't asked for shirt sizes, for example).
  const asked = new Set(askedFields(fields, me).map((f) => f.id));
  const open = requests.filter((r) => r.fields.some((f) => asked.has(f) && !has(f)));
  if (!open.length || priv.isLoading) return null;
  const missing = [...new Set(open.flatMap((r) => r.fields.filter((f) => asked.has(f) && !has(f))))].map((id) => fields.find((f) => f.id === id)).filter(Boolean) as ProfileFieldDef[];
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
            <VisibilityNote locked={f.private}>{LEVEL_NOTE[f.level]}</VisibilityNote>
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
