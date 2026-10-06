import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Award, Check, ExternalLink, GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Avatar,
  Banner,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  Input,
  PositionBadge,
  Segmented,
  Select,
  Spinner,
  Textarea,
  cn,
  downloadText,
  formatDate,
  toCsv,
  toast,
  useConfirm,
  validateRequired,
  OptionalTag,
} from '@teamhub/ui';
import {
  canWith,
  friendlyError,
  ModuleHeader,
  ModulePurpose,
  TeamScopePicker,
  useActivePeople,
  useCan,
  useCreateShortcut,
  useLocalStorage,
  useMe,
  useNewParam,
  usePeople,
  useRows,
  useSubteams,
  useSupabase,
  useTeamScope,
} from '@teamhub/sdk';

export interface Skill {
  id: string;
  team_id: string | null;
  name: string;
  category: string | null;
  subteam_id: string | null;
  description: string | null;
  url: string | null;
  requires: string[];
}
export interface Signoff {
  skill_id: string;
  user_id: string;
  signed_by: string | null;
  signed_at: string;
}
export const useSkills = () => useRows<Skill>(['skills', 'list'], (sb) => sb.from('skill_skills').select('*').order('category').order('name'));
export const useSignoffs = () => useRows<Signoff>(['skills', 'signoffs'], (sb) => sb.from('skill_signoffs').select('*'));

/** Skills whose prerequisites this person has, but not the skill itself. */
export function nextSkills(skills: Skill[], signoffs: Signoff[], userId: string): Skill[] {
  const have = new Set(signoffs.filter((s) => s.user_id === userId).map((s) => s.skill_id));
  return skills.filter((s) => !have.has(s.id) && s.requires.every((r) => have.has(r)));
}

export default function SkillsRoutes() {
  const skills = useSkills();
  const signoffs = useSignoffs();
  const scope = useTeamScope();
  const me = useMe();
  const canManage = useCan('skills.manage');
  const [view, setView] = useLocalStorage<'mine' | 'matrix'>('teamhub-skills-view', 'mine');
  const [creating, setCreating] = useNewParam();
  const [editing, setEditing] = useState<Skill | null>(null);
  const [signing, setSigning] = useState<Skill | null>(null);
  useCreateShortcut(() => setCreating(true), canManage);
  const list = (skills.data ?? []).filter((s) => !scope || !s.team_id || s.team_id === scope);
  if (skills.isLoading) return <Spinner className="m-8" />;
  return (
    <div>
      <ModuleHeader moduleId="skills" actions={canManage && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Add skill</Button>}>
        <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'mine', label: 'My skills' }, { value: 'matrix', label: 'Everyone' }]} />
      </ModuleHeader>
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        {!list.length ? (
          <EmptyState icon={<GraduationCap />} title="No skills yet" body={<ModulePurpose moduleId="skills" compact className="mt-2 text-left" />} />
        ) : view === 'mine' ? (
          <MySkills skills={list} signoffs={signoffs.data ?? []} userId={me.id} onEdit={canManage ? setEditing : undefined} onSign={setSigning} />
        ) : (
          <Matrix skills={list} signoffs={signoffs.data ?? []} onSign={setSigning} />
        )}
      </div>
      {(editing || creating) && <SkillEditor skill={editing} all={list} onClose={() => (setEditing(null), setCreating(false))} />}
      {signing && <SignOffDialog skill={signing} signoffs={signoffs.data ?? []} onClose={() => setSigning(null)} />}
    </div>
  );
}

function SkillCard({ s, done, onEdit, onSign }: { s: Skill; done?: Signoff; onEdit?: (s: Skill) => void; onSign: (s: Skill) => void }) {
  const me = useMe();
  return (
    <li className={cn('flex items-start gap-3 rounded-lg border bg-surface p-3', done ? 'border-success/40' : 'border-border')}>
      <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full', done ? 'bg-success-soft text-success' : 'bg-bg-subtle text-faint')}>{done ? <Check className="size-4" /> : <GraduationCap className="size-4" />}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">{s.name}</p>
        {s.description && <p className="text-[12.5px] text-muted">{s.description}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[12px] text-faint">
          {done && (
            <span>
              Signed off {formatDate(done.signed_at)}
            </span>
          )}
          {s.url && (
            <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
              Training material <ExternalLink className="size-3" />
            </a>
          )}
        </p>
      </div>
      {canWith(me, 'skills.sign_off', s.team_id) && (
        <Button size="sm" variant="ghost" onClick={() => onSign(s)}>
          Sign off people
        </Button>
      )}
      {onEdit && (
        <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => onEdit(s)}>
          <span className="sr-only">Edit {s.name}</span>
        </Button>
      )}
    </li>
  );
}

function MySkills({ skills, signoffs, userId, onEdit, onSign }: { skills: Skill[]; signoffs: Signoff[]; userId: string; onEdit?: (s: Skill) => void; onSign: (s: Skill) => void }) {
  const mine = new Map(signoffs.filter((s) => s.user_id === userId).map((s) => [s.skill_id, s]));
  const next = nextSkills(skills, signoffs, userId);
  const locked = skills.filter((s) => !mine.has(s.id) && !next.includes(s));
  const name = new Map(skills.map((s) => [s.id, s.name]));
  return (
    <div className="space-y-6">
      {mine.size > 0 && (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">Your skills ({mine.size})</h2>
          <div className="flex flex-wrap gap-1.5">
            {skills.filter((s) => mine.has(s.id)).map((s) => (
              <PositionBadge key={s.id} name={s.name} kind="skill" />
            ))}
          </div>
        </section>
      )}
      {next.length > 0 && (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">Skills you can learn next</h2>
          <p className="mb-2 text-[12.5px] text-muted">Learn it, then ask someone who can sign off (a mentor, captain or safety captain) to check you off.</p>
          <ul className="grid gap-2 md:grid-cols-2">
            {next.map((s) => (
              <SkillCard key={s.id} s={s} onEdit={onEdit} onSign={onSign} />
            ))}
          </ul>
        </section>
      )}
      {locked.length > 0 && (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">Later</h2>
          <ul className="space-y-1 text-[13px] text-muted">
            {locked.map((s) => (
              <li key={s.id}>
                <span className="font-medium text-fg">{s.name}</span>: after {s.requires.map((r) => name.get(r)).filter(Boolean).join(', ')}
              </li>
            ))}
          </ul>
        </section>
      )}
      {mine.size > 0 && (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">Details</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {skills.filter((s) => mine.has(s.id)).map((s) => (
              <SkillCard key={s.id} s={s} done={mine.get(s.id)} onEdit={onEdit} onSign={onSign} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Matrix({ skills, signoffs, onSign }: { skills: Skill[]; signoffs: Signoff[]; onSign: (s: Skill) => void }) {
  const scope = useTeamScope();
  const people = useActivePeople(scope);
  const me = useMe();
  const subteams = useSubteams();
  const [sub, setSub] = useState('');
  const has = useMemo(() => new Set(signoffs.map((s) => `${s.skill_id}:${s.user_id}`)), [signoffs]);
  const cols = skills.filter((s) => !sub || s.subteam_id === sub);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {subteams.length > 0 && (
          <Select aria-label="Subteam" className="w-44" value={sub} onChange={(e) => setSub(e.target.value)}>
            <option value="">All subteams</option>
            {subteams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => downloadText(toCsv([['Person', ...cols.map((s) => s.name)], ...people.map((p) => [p.name, ...cols.map((s) => (has.has(`${s.id}:${p.id}`) ? 'yes' : ''))])]), 'skills.csv', 'text/csv')}>
          CSV
        </Button>
      </div>
      <div className="relative overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-[13px]">
          <thead className="bg-bg-subtle/60">
            <tr>
              <th className="sticky left-0 bg-bg-subtle px-3 py-2 text-left font-medium">Person</th>
              {cols.map((s) => (
                <th key={s.id} className="px-2 py-2 text-center font-medium">
                  {canWith(me, 'skills.sign_off', s.team_id) ? (
                    <button className="hover:text-accent hover:underline" onClick={() => onSign(s)}>
                      {s.name}
                    </button>
                  ) : (
                    s.name
                  )}
                  <span className="block text-[11px] font-normal text-faint">{people.filter((p) => has.has(`${s.id}:${p.id}`)).length}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {people.map((p) => (
              <tr key={p.id}>
                <td className="sticky left-0 bg-surface px-3 py-1.5">
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={p.name} src={p.avatarUrl} size={20} /> {p.name}
                  </span>
                </td>
                {cols.map((s) => (
                  <td key={s.id} className="text-center">
                    {has.has(`${s.id}:${p.id}`) ? <Award className="mx-auto size-4 text-success" aria-label="Signed off" /> : <span className="text-faint">·</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SignOffDialog({ skill, signoffs, onClose }: { skill: Skill; signoffs: Signoff[]; onClose: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const people = useActivePeople(skill.team_id);
  const all = usePeople();
  const [q, setQ] = useState('');
  const done = new Map(signoffs.filter((s) => s.skill_id === skill.id).map((s) => [s.user_id, s]));
  const toggle = async (user: string, on: boolean) => {
    const res = on ? await sb.from('skill_signoffs').insert({ skill_id: skill.id, user_id: user, signed_by: me.id }) : await sb.from('skill_signoffs').delete().match({ skill_id: skill.id, user_id: user });
    if (res.error) return toast.error(friendlyError(res.error));
    qc.invalidateQueries({ queryKey: ['skills'] });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Sign off: ${skill.name}`} description="Check people who have shown they can do this safely and correctly." size="md">
      <Input placeholder="Find a person…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
      <ul className="max-h-[50vh] space-y-1 relative overflow-y-auto">
        {people
          .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
          .map((p) => {
            const d = done.get(p.id);
            return (
              <li key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-bg-subtle">
                <Checkbox
                  checked={!!d}
                  disabled={p.id === me.id && !me.isAdmin}
                  onChange={(v) => toggle(p.id, v)}
                  label={
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={p.name} src={p.avatarUrl} size={22} /> {p.name}
                    </span>
                  }
                />
                {d && <span className="ml-auto text-[11.5px] text-faint">by {all.data?.get(d.signed_by ?? '')?.name ?? 'someone'} · {formatDate(d.signed_at)}</span>}
              </li>
            );
          })}
      </ul>
      <p className="mt-2 text-[12px] text-faint">You can't sign yourself off.</p>
    </Dialog>
  );
}

function SkillEditor({ skill, all, onClose }: { skill: Skill | null; all: Skill[]; onClose: () => void }) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const scope = useTeamScope();
  const subteams = useSubteams();
  const [v, setV] = useState({
    name: skill?.name ?? '',
    category: skill?.category ?? '',
    description: skill?.description ?? '',
    url: skill?.url ?? '',
    subteam_id: skill?.subteam_id ?? '',
    team_id: skill ? skill.team_id : scope,
    requires: skill?.requires ?? [],
  });
  const save = async () => {
    if (!validateRequired()) return;
    if (!v.name.trim()) return toast.error('Name the skill');
    if (v.url && !/^https?:\/\//i.test(v.url)) return toast.error('Training link must start with https://');
    const body = { name: v.name.trim(), category: v.category.trim() || null, description: v.description.trim() || null, url: v.url.trim() || null, subteam_id: v.subteam_id || null, team_id: v.team_id, requires: v.requires };
    const { error } = skill ? await sb.from('skill_skills').update(body).eq('id', skill.id) : await sb.from('skill_skills').insert(body);
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['skills'] });
    onClose();
  };
  const categories = [...new Set(all.map((s) => s.category).filter(Boolean))] as string[];
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={skill ? 'Edit skill' : 'Add a skill'}
      size="md"
      footer={
        <>
          {skill && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (!(await confirm({ title: `Delete “${skill.name}”?`, body: 'All sign-offs for it are deleted too.', danger: true, confirmLabel: 'Delete' }))) return;
                await sb.from('skill_skills').delete().eq('id', skill.id);
                qc.invalidateQueries({ queryKey: ['skills'] });
                onClose();
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!skill && <Banner tone="info">Skills are proven abilities (“Drill press safety”), not job titles: those are Positions in People.</Banner>}
        <Field label="Skill" required>{(id) => <Input id={id} autoFocus maxLength={80} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Drill press safety" />}</Field>
        <Field label="Category" optional>
          {(id) => (
            <>
              <Input id={id} list="skill-cats" maxLength={40} value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} placeholder="Safety, CAD, Driving…" />
              <datalist id="skill-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </>
          )}
        </Field>
        {subteams.length > 0 && (
          <Field label="Subteam" optional>
            {(id) => (
              <Select id={id} value={v.subteam_id} onChange={(e) => setV({ ...v, subteam_id: e.target.value })}>
                <option value="">None</option>
                {subteams.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="What it means" optional>{(id) => <Textarea id={id} rows={2} maxLength={2000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />}</Field>
        <Field label="Training link" optional>{(id) => <Input id={id} type="url" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} placeholder="https://…" />}</Field>
        {all.filter((s) => s.id !== skill?.id).length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13px] font-medium">Learn these first <OptionalTag /></legend>
            {all
              .filter((s) => s.id !== skill?.id)
              .map((s) => (
                <Checkbox key={s.id} checked={v.requires.includes(s.id)} onChange={(on) => setV({ ...v, requires: on ? [...v.requires, s.id] : v.requires.filter((x) => x !== s.id) })} label={s.name} />
              ))}
          </fieldset>
        )}
        <TeamScopePicker value={v.team_id} onChange={(t) => setV({ ...v, team_id: t })} perm="skills.manage" />
      </div>
    </Dialog>
  );
}
