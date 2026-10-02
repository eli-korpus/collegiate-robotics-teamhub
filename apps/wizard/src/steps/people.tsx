import { useEffect, useMemo, useState } from 'react';
import { Lock, Plus, Trash2 } from 'lucide-react';
import { positionIdFor, slugify, type PermissionGrant, type ProfileType } from '@teamhub/config-schema';
import type { PermissionDefs } from '@teamhub/sdk/define';
import { Badge, Button, Checkbox, IconButton, Input, Segmented, Select, Spinner, Switch } from '@teamhub/ui';
import { api } from '../api';
import { Section, StepShell, Why } from '../components';
import { SUGGESTED_FIELDS, useDraft } from '../draft';
import type { StepProps } from './basics';

const GENERIC_POSITIONS = ['Lead Programmer', 'Drive Coach', 'Driver 1', 'Driver 2', 'Safety Captain'];

export function People({ onNext, onBack }: StepProps) {
  const { draft, update, catalog } = useDraft();
  const c = draft.config;
  const [newSub, setNewSub] = useState('');
  const [newPos, setNewPos] = useState('');
  const suggestions = useMemo(() => {
    const s = new Set<string>(GENERIC_POSITIONS);
    for (const m of catalog.modules) if (m.id in c.modules) m.suggestedPositions.forEach((p) => s.add(p));
    return [...s].filter((name) => !c.positions.some((p) => p.id === positionIdFor(name)));
  }, [catalog.modules, c.modules, c.positions]);
  const addPosition = (name: string) =>
    update((x) => {
      const id = positionIdFor(name);
      if (!x.positions.some((p) => p.id === id)) x.positions.push({ id, name, teamId: null, grantsPermissions: true });
    });

  return (
    <StepShell title="People, subteams & positions" subtitle="These lists are shared by every tab, so they're defined once here." onBack={onBack} onNext={onNext}>
      <Section title="Subteams" description="One list used by People, Tasks, Notebook and Skills.">
        <div className="flex flex-wrap gap-2">
          {c.subteams.map((s, i) => (
            <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-subtle py-0.5 pl-3 pr-1 text-[13px]">
              {s.name}
              <IconButton label={`Remove ${s.name}`} size="sm" className="size-6" onClick={() => update((x) => void x.subteams.splice(i, 1))}>
                <Trash2 className="size-3.5" />
              </IconButton>
            </span>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newSub.trim();
            if (!name) return;
            update((x) => void x.subteams.push({ id: slugify(name).replace(/_/g, '-') || `sub-${x.subteams.length}`, name }));
            setNewSub('');
          }}
        >
          <Input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Add a subteam (e.g. Strategy)" />
          <Button type="submit" icon={<Plus className="size-4" />}>
            Add
          </Button>
        </form>
      </Section>

      <Section title="Positions" description="Named responsibilities like “3D Print Farm Manager”. Tabs use them for permissions and routing (e.g. print jobs go to whoever holds that position).">
        {c.positions.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {c.positions.map((p, i) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="min-w-32 flex-1 text-[13.5px] font-medium">{p.name}</span>
                {c.program.multiTeam && (
                  <Select value={p.teamId ?? ''} onChange={(e) => update((x) => void (x.positions[i].teamId = e.target.value || null))} className="w-40" aria-label="Applies to">
                    <option value="">Whole program</option>
                    {c.teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name || `Team ${t.shortCode}`}
                      </option>
                    ))}
                  </Select>
                )}
                <IconButton label={`Remove ${p.name}`} size="sm" onClick={() => update((x) => void x.positions.splice(i, 1))}>
                  <Trash2 className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12.5px] text-muted">Suggested:</span>
            {suggestions.map((s) => (
              <Button key={s} size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => addPosition(s)}>
                {s}
              </Button>
            ))}
          </div>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newPos.trim()) addPosition(newPos.trim());
            setNewPos('');
          }}
        >
          <Input value={newPos} onChange={(e) => setNewPos(e.target.value)} placeholder="Add a position" />
          <Button type="submit" icon={<Plus className="size-4" />}>
            Add
          </Button>
        </form>
        <p className="text-[12.5px] text-muted">Mentors can also create badge-only positions later in the dashboard. Proven abilities (“Certified driver”) belong in Skills & Training.</p>
      </Section>

      <Section title="Profile fields" description="Optional extra info on each profile. Mentors can ask for missing values with People > Request info: the safe way to collect personal info.">
        <div className="space-y-2">
          {SUGGESTED_FIELDS.map((f) => {
            const on = c.profileFields.some((x) => x.id === f.id);
            return (
              <div key={f.id} className="flex items-center gap-3">
                <Checkbox
                  checked={on}
                  onChange={(v) =>
                    update((x) => {
                      if (v) x.profileFields.push({ ...f, options: f.id === 'subteam' ? x.subteams.map((s) => s.name) : f.options });
                      else x.profileFields = x.profileFields.filter((y) => y.id !== f.id);
                    })
                  }
                  label={f.label}
                />
                {f.private && (
                  <Badge tone="warning">
                    <Lock className="size-3" /> Only the person and mentors
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[12.5px] text-muted">TeamHub never asks for birthdays, addresses or phone numbers by default. Keep personal data to what you really need (FIRST Youth Protection).</p>
      </Section>
    </StepShell>
  );
}

const TYPES: ProfileType[] = ['member', 'captain', 'mentor'];
const TYPE_LABEL = { member: 'Members', captain: 'Captains', mentor: 'Mentors' };

export function Permissions({ onNext, onBack }: StepProps) {
  const { draft, update, catalog } = useDraft();
  const c = draft.config;
  const [defs, setDefs] = useState<PermissionDefs | null>(null);
  const [view, setView] = useState<'simple' | 'advanced'>('simple');
  useEffect(() => {
    api<PermissionDefs>('/permissions', c).then(setDefs);
     
  }, [JSON.stringify(c.modules)]);
  if (!defs) return <Spinner className="m-10" />;
  const positionIds = new Set(c.positions.map((p) => p.id));
  const grant = (k: string): PermissionGrant =>
    c.permissions[k] ?? { types: [...defs[k].default], positions: (defs[k].positions ?? []).filter((p) => positionIds.has(p)) };
  const set = (k: string, g: PermissionGrant) => update((x) => void (x.permissions[k] = g));
  const names = new Map([['people', 'People'], ['core', 'Tool links'], ...catalog.modules.map((m) => [m.id, m.name] as [string, string])]);
  const groups = new Map<string, string[]>();
  for (const [k, d] of Object.entries(defs)) {
    if (view === 'simple' && !d.simple) continue;
    groups.set(d.module, [...(groups.get(d.module) ?? []), k]);
  }
  return (
    <StepShell
      title="Who can do what"
      subtitle="Pre-filled with sensible defaults for each tab. Admins can always do everything."
      onBack={onBack}
      onNext={onNext}
      footerExtra={
        <Button variant="ghost" onClick={() => update((x) => void (x.permissions = {}))}>
          Reset to defaults
        </Button>
      }
    >
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'simple', label: 'Simple: the key decisions' },
          { value: 'advanced', label: 'Advanced: everything' },
        ]}
      />
      {[...groups.entries()].map(([mod, keys]) => (
        <Section key={mod} title={names.get(mod) ?? mod}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="py-1 font-medium">Permission</th>
                  {TYPES.map((t) => (
                    <th key={t} className="w-20 py-1 text-center font-medium">
                      {TYPE_LABEL[t]}
                    </th>
                  ))}
                  {c.positions.length > 0 && <th className="py-1 font-medium">Positions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {keys.map((k) => {
                  const g = grant(k);
                  return (
                    <tr key={k}>
                      <td className="py-2 pr-2">{defs[k].label}</td>
                      {TYPES.map((t) => (
                        <td key={t} className="text-center">
                          <Checkbox
                            checked={g.types.includes(t)}
                            onChange={(v) => set(k, { ...g, types: v ? [...g.types, t] : g.types.filter((x) => x !== t) })}
                            label={<span className="sr-only">{`${TYPE_LABEL[t]}: ${defs[k].label}`}</span>}
                          />
                        </td>
                      ))}
                      {c.positions.length > 0 && (
                        <td className="py-1">
                          <div className="flex flex-wrap gap-1">
                            {c.positions.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                aria-pressed={g.positions.includes(p.id)}
                                onClick={() => set(k, { ...g, positions: g.positions.includes(p.id) ? g.positions.filter((x) => x !== p.id) : [...g.positions, p.id] })}
                                className={g.positions.includes(p.id) ? 'rounded-md bg-accent-soft px-1.5 py-0.5 text-[11.5px] font-medium text-fg' : 'rounded-md border border-border px-1.5 py-0.5 text-[11.5px] text-faint'}
                              >
                                {p.name}
                              </button>
                            ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      ))}
      <Why title="How are permissions enforced?">
        <p>Your choices are compiled into the database’s access rules, so they can’t be bypassed: the dashboard only hides buttons you can’t use. Changing them later is just an Edit in this wizard.</p>
        <p>Approvals are tiered: captains and mentors approve members; only mentors and admins approve captains and mentors.</p>
      </Why>
      <Switch checked={c.features.email} onChange={() => {}} disabled label="Email confirmation" description="Off: no email provider needed. A captain or mentor approves every signup. Turn on later from the wizard home after adding SMTP in Supabase." />
    </StepShell>
  );
}
