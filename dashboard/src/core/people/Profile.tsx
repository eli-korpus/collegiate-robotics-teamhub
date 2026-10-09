import { Suspense, useState } from 'react';
import type { PersonInfo } from '@teamhub/sdk';
import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, KeyRound, Lock, MoreHorizontal, Pencil, Shield, Trash2, UserCheck, UserX } from 'lucide-react';
import { Avatar, Button, Card, CardHeader, Dialog, EmptyState, IconButton, Input, Menu, NameFields, PositionBadge, Select, Spinner, TYPE_LABEL, joinName, splitName, toast, useConfirm } from '@teamhub/ui';
import { canWith, friendlyError, isMultiTeam, runtime, useMe, usePeople, useSupabase, TeamBadge } from '@teamhub/sdk';
import { canSeeLevel, fieldValue, ProfileFieldInput, saveProfileFields, useHiddenValues, useProfileFields, type HiddenValues } from './profileFields';
import { TeamLogo } from '../auth/AuthLayout';

export function Profile() {
  const { id } = useParams();
  const people = usePeople();
  const nav = useNavigate();
  const me = useMe();
  const p = id ? people.data?.get(id) : undefined;
  if (people.isLoading) return <Spinner className="m-8" />;
  if (!p) return <EmptyState title="Person not found" body="They may have left the program." action={<Button onClick={() => nav('/people')}>Back to People</Button>} />;
  const isSelf = p.id === me.id;
  const canManageTeams = !isSelf && p.status === 'active' && (me.isAdmin || runtime().config.teams.some((t) => canWith(me, 'people.approve_members', t.id)));
  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
      <button type="button" onClick={() => nav(-1)} className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Back
      </button>
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={p.name} src={p.avatarUrl} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-tight">{p.name}</h1>
          <p className="text-[13px] text-muted">
            {p.status !== 'active' ? (p.status === 'pending' ? 'Waiting for approval' : 'Inactive') : p.isAdmin ? 'Admin' : ''}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.positions.map((x) => (
              <PositionBadge key={x} name={x} />
            ))}
          </div>
        </div>
        {isSelf ? (
          <Button onClick={() => nav('/me')}>Edit my profile</Button>
        ) : (
          <div className="flex items-center gap-2">
            <EditPersonButton p={p} canTeams={canManageTeams} variant="primary" />
            <PersonActions userId={p.id} />
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title={isMultiTeam() ? 'Teams' : 'Team'} action={canManageTeams && isMultiTeam() && <TeamsButton p={p} />} />
          <ul className="space-y-2 px-4 pb-4">
            {p.memberships.map((m) => {
              const t = runtime().config.teams.find((x) => x.id === m.team_id);
              return (
                <li key={m.team_id} className="flex items-center gap-3 text-[13.5px]">
                  <TeamLogo teamId={m.team_id} size={28} />
                  <span className="flex-1">{t?.name}</span>
                  <span className="text-muted">{m.status === 'active' ? TYPE_LABEL[m.type] : m.status === 'pending' ? 'Pending' : 'Inactive'}</span>
                </li>
              );
            })}
          </ul>
        </Card>
        <ProfileFieldsCard p={p} canTeams={canManageTeams} />
        {runtime().modules.flatMap((m) =>
          (m.client.profileSections ?? [])
            .filter((s) => !s.perm || isSelf || canWith(me, s.perm))
            .map((s) => {
              const C = s.component;
              return (
                // A section with nothing to show (no skills yet, no tasks…) hides its whole card.
                <Card key={`${m.manifest.id}:${s.id}`} className="[&:has(>div:empty)]:hidden">
                  <CardHeader title={s.title} subtitle={m.manifest.name} />
                  <div className="px-4 pb-4">
                    <Suspense fallback={<Spinner />}>
                      <C userId={p.id} />
                    </Suspense>
                  </div>
                </Card>
              );
            }),
        )}
      </div>
    </div>
  );
}

/** Who may edit what about someone (the same rules the database enforces), plus their private fields. */
function usePersonEditing(p: PersonInfo) {
  const me = useMe();
  // People who assign positions edit profiles; team-only and mentors-only fields only appear to those who can see them.
  // Only admins edit an admin's profile (same rule as the database).
  const canEdit = p.id !== me.id && (me.isAdmin || (!p.isAdmin && p.memberships.some((m) => canWith(me, 'people.assign_positions', m.team_id))));
  const fields = useProfileFields().filter((f) => canSeeLevel(me, f.level, p));
  const hidden = useHiddenValues(p.id);
  return { fields, canEdit, hidden: hidden.data ?? { leaders: {}, mentors: {} } };
}

/** "Edit": one window for someone's name, teams and roles, and profile fields (subteams, shirt size…). */
function EditPersonButton({ p, canTeams, variant = 'ghost' }: { p: PersonInfo; canTeams: boolean; variant?: 'ghost' | 'primary' }) {
  const e = usePersonEditing(p);
  const [open, setOpen] = useState(false);
  if (!e.canEdit && !canTeams) return null;
  return (
    <>
      <Button size={variant === 'ghost' ? 'sm' : 'md'} variant={variant} icon={<Pencil className="size-3.5" />} onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open && <EditPersonDialog p={p} canProfile={e.canEdit} canTeams={canTeams} fields={e.fields} hidden={e.hidden} onClose={() => setOpen(false)} />}
    </>
  );
}

function ProfileFieldsCard({ p, canTeams }: { p: PersonInfo; canTeams: boolean }) {
  const { fields, canEdit, hidden } = usePersonEditing(p);
  if (!fields.length && !canEdit) return null;
  return (
    <Card>
      <CardHeader title="Profile" action={canEdit && <EditPersonButton p={p} canTeams={canTeams} />} />
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 px-4 pb-4 text-[13.5px]">
        {fields.map((f) => (
            <div key={f.id} className="contents">
              <dt className="flex items-center gap-1 text-muted">
                {f.label} {f.private && <Lock className="size-3 text-warning" aria-label={f.level === 'leaders' ? 'Team leaders only' : 'Mentors only'} />}
              </dt>
              <dd>{fieldValue(f, p.details, hidden) || <span className="text-faint">–</span>}</dd>
            </div>
          ))}
      </dl>
    </Card>
  );
}

/** Mentor/admin tools: type, reset link, deactivate, delete, admin flag (spec §7.5, §12.2). */
function PersonActions({ userId }: { userId: string }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const people = usePeople();
  const p = people.data!.get(userId)!;
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [typeFor, setTypeFor] = useState<string | null>(null);
  const [newType, setNewType] = useState('member');
  const refresh = () => qc.invalidateQueries({ queryKey: ['core'] });
  const anyTeam = (perm: string) => p.memberships.some((m) => canWith(me, perm, m.team_id));
  const canReset = (me.isAdmin || (!p.isAdmin && anyTeam('people.reset_password'))) && p.status !== 'pending';
  const canDeactivate = me.isAdmin || anyTeam('people.deactivate');
  const changeableTeams = p.memberships.filter((m) => m.status === 'active' && canWith(me, 'people.approve_members', m.team_id));
  if (!canReset && !canDeactivate && !me.isAdmin && !changeableTeams.length) return null;

  return (
    <>
      <Menu
        trigger={
          <IconButton label="Manage person" variant="secondary">
            <MoreHorizontal className="size-4" />
          </IconButton>
        }
        items={[
          changeableTeams.length > 0 && {
            label: 'Change profile type…',
            icon: <UserCheck />,
            onSelect: () => {
              setTypeFor(changeableTeams[0].team_id);
              setNewType(changeableTeams[0].type);
            },
          },
          canReset && {
            label: 'Generate password reset link',
            icon: <KeyRound />,
            onSelect: async () => {
              const { data, error } = await sb.functions.invoke('admin-reset-link', { body: { user_id: userId, redirect_to: `${location.origin}${import.meta.env.BASE_URL}reset-password` } });
              if (error || !data?.link) return toast.error(friendlyError(error ?? new Error('Could not create a link')));
              setResetLink(data.link);
            },
          },
          me.isAdmin &&
            p.status === 'active' && {
              label: p.isAdmin ? 'Remove admin' : 'Make admin',
              icon: <Shield />,
              separatorBefore: true,
              onSelect: async () => {
                if (!(await confirm({ title: p.isAdmin ? `Remove admin from ${p.name}?` : `Make ${p.name} an admin?`, body: p.isAdmin ? undefined : 'Admins have every permission everywhere.' }))) return;
                const { error } = await sb.rpc('people_set_admin', { p_user: userId, p_on: !p.isAdmin });
                if (error) toast.error(friendlyError(error));
                refresh();
              },
            },
          canDeactivate &&
            p.status !== 'pending' && {
              label: p.status === 'active' ? 'Deactivate' : 'Reactivate',
              icon: <UserX />,
              separatorBefore: !me.isAdmin,
              onSelect: async () => {
                const active = p.status !== 'active';
                if (!active && !(await confirm({ title: `Deactivate ${p.name}?`, body: 'They can no longer sign in to the dashboard. Their history stays attributed to them.', confirmLabel: 'Deactivate', danger: true }))) return;
                const { error } = await sb.rpc('people_set_active', { p_user: userId, p_team: null, p_active: active });
                if (error) toast.error(friendlyError(error));
                refresh();
              },
            },
          canDeactivate && {
            label: 'Delete account',
            icon: <Trash2 />,
            danger: true,
            onSelect: async () => {
              if (!(await confirm({ title: `Delete ${p.name}'s account?`, body: 'Their login is deleted and their name becomes “Former member” on everything they contributed. This cannot be undone.', danger: true, confirmLabel: 'Delete', typeToConfirm: 'DELETE' }))) return;
              const { error } = await sb.functions.invoke('admin-delete-user', { body: { user_id: userId } });
              if (error) return toast.error(friendlyError(error));
              toast.success('Account deleted');
              refresh();
            },
          },
        ]}
      />
      <Dialog open={!!resetLink} onOpenChange={(v) => !v && setResetLink(null)} title="Password reset link" description={`Send this link to ${p.name} privately (e.g. in person or a direct message). It works once and expires soon.`}>
        <div className="flex gap-2">
          <Input readOnly value={resetLink ?? ''} onFocus={(e) => e.currentTarget.select()} aria-label="Reset link" />
          <Button
            icon={<Copy className="size-4" />}
            onClick={async () => {
              await navigator.clipboard.writeText(resetLink ?? '');
              toast.success('Copied');
            }}
          >
            Copy
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={!!typeFor}
        onOpenChange={(v) => !v && setTypeFor(null)}
        title="Change profile type"
        footer={
          <Button
            variant="primary"
            onClick={async () => {
              const { error } = await sb.rpc('people_set_type', { p_user: userId, p_team: typeFor, p_type: newType });
              if (error) return toast.error(friendlyError(error));
              setTypeFor(null);
              refresh();
            }}
          >
            Save
          </Button>
        }
      >
        <div className="space-y-3">
          {changeableTeams.length > 1 && (
            <Select value={typeFor ?? ''} onChange={(e) => setTypeFor(e.target.value)} aria-label="Team">
              {changeableTeams.map((m) => (
                <option key={m.team_id} value={m.team_id}>
                  {runtime().config.teams.find((t) => t.id === m.team_id)?.name}
                </option>
              ))}
            </Select>
          )}
          <Select value={newType} onChange={(e) => setNewType(e.target.value)} aria-label="Profile type">
            <option value="member">Member</option>
            {canWith(me, 'people.approve_leaders', typeFor) && (
              <>
                <option value="captain">Captain</option>
                <option value="mentor">Mentor</option>
              </>
            )}
          </Select>
          <TeamBadge teamId={typeFor} />
        </div>
      </Dialog>
    </>
  );
}

/** Add someone to a team, change their role on it, or take them off it (multi-team programs). */
function TeamsButton({ p }: { p: PersonInfo }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setOpen(true)}>
        Change teams
      </Button>
      {open && <TeamsDialog p={p} onClose={() => setOpen(false)} />}
    </>
  );
}

function TeamsDialog({ p, onClose, embedded = false }: { p: PersonInfo; onClose: () => void; embedded?: boolean }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [addAs, setAddAs] = useState<Record<string, string>>({});
  const run = async (key: string, fn: () => PromiseLike<{ error: unknown }>, done: string) => {
    setBusy(key);
    const { error } = await fn();
    setBusy(null);
    if (error) return toast.error(friendlyError(error));
    toast.success(done);
    qc.invalidateQueries({ queryKey: ['core'] });
  };
  const activeCount = p.memberships.filter((m) => m.status === 'active').length;
  const editor = (
      <ul className="divide-y divide-border rounded-lg border border-border">
        {runtime().config.teams.map((t) => {
          const m = p.memberships.find((x) => x.team_id === t.id);
          const canLeaders = canWith(me, 'people.approve_leaders', t.id);
          const canAdd = canWith(me, 'people.approve_members', t.id);
          const role = addAs[t.id] ?? 'member';
          return (
            <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-[13.5px]">
              <TeamLogo teamId={t.id} size={24} />
              <span className="min-w-0 flex-1 font-medium">
                {t.name}
                {t.number ? <span className="font-normal text-muted"> ({t.number})</span> : null}
              </span>
              {m?.status === 'active' ? (
                <>
                  <Select
                    aria-label={`Role on ${t.name}`}
                    className="h-8 w-28 text-[13px]"
                    value={m.type}
                    disabled={!canAdd || busy !== null}
                    onChange={(e) => run(t.id, () => sb.rpc('people_set_type', { p_user: p.id, p_team: t.id, p_type: e.target.value }), `Role on ${t.name} updated`)}
                  >
                    <option value="member">Member</option>
                    {(canLeaders || m.type !== 'member') && <option value="captain">Captain</option>}
                    {(canLeaders || m.type === 'mentor') && <option value="mentor">Mentor</option>}
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    loading={busy === t.id + ':remove'}
                    disabled={!canWith(me, 'people.deactivate', t.id) || busy !== null}
                    title={activeCount <= 1 ? 'This is their only team. Deactivate them instead.' : undefined}
                    onClick={async () => {
                      if (activeCount <= 1) return toast.error('This is their only team. To remove them completely, use Deactivate in the menu.');
                      if (!(await confirm({ title: `Remove ${p.name} from ${t.name}?`, body: 'They lose access to items only for that team. Anything they made stays.', confirmLabel: 'Remove', danger: true }))) return;
                      run(t.id + ':remove', () => sb.rpc('people_remove_from_team', { p_user: p.id, p_team: t.id }), `Removed from ${t.name}`);
                    }}
                  >
                    Remove
                  </Button>
                </>
              ) : m?.status === 'pending' ? (
                <span className="text-[12.5px] text-muted">Asked to join: approve in People &gt; Requests</span>
              ) : canAdd ? (
                <>
                  <Select aria-label={`Role to add on ${t.name}`} className="h-8 w-28 text-[13px]" value={role} onChange={(e) => setAddAs({ ...addAs, [t.id]: e.target.value })}>
                    <option value="member">Member</option>
                    {canLeaders && <option value="captain">Captain</option>}
                    {canLeaders && <option value="mentor">Mentor</option>}
                  </Select>
                  <Button
                    size="sm"
                    loading={busy === t.id}
                    disabled={busy !== null}
                    onClick={() => run(t.id, () => sb.rpc('people_add_to_team', { p_user: p.id, p_team: t.id, p_type: role }), `Added to ${t.name}`)}
                  >
                    {m?.status === 'inactive' ? 'Reactivate' : 'Add'}
                  </Button>
                </>
              ) : (
                <span className="text-[12.5px] text-faint">Not on this team</span>
              )}
            </li>
          );
        })}
      </ul>
  );
  if (embedded) return editor;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={`Teams for ${p.name}`} description="Add them to a team, change their role on a team, or take them off one. Their past work stays attributed to them.">
      {editor}
      <p className="mt-2 text-[12px] text-faint">To move someone, add them to the new team, then remove them from the old one.</p>
    </Dialog>
  );
}

/** Fix someone's name and profile fields, and (if allowed) their teams and roles, in one window. */
function EditPersonDialog({ p, canProfile, canTeams, fields, hidden, onClose }: { p: PersonInfo; canProfile: boolean; canTeams: boolean; fields: ReturnType<typeof useProfileFields>; hidden: HiddenValues; onClose: () => void }) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const [n, setN] = useState(() => splitName(p.name));
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(fields.map((f) => [f.id, fieldValue(f, p.details, hidden)])));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!canProfile) return onClose();
    if (!n.first.trim() || !n.last.trim()) return toast.error('Enter a first and last name');
    setBusy(true);
    try {
      if (joinName(n) !== p.name) {
        const { error } = await sb.from('profiles').update({ display_name: joinName(n).slice(0, 80) }).eq('id', p.id);
        if (error) throw error;
      }
      await saveProfileFields(sb, p.id, fields, values, { details: p.details, hidden });
      qc.invalidateQueries({ queryKey: ['core'] });
      toast.success('Profile updated');
      onClose();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Edit ${p.name}`}
      description="Changes show on their profile right away. Fields with a lock stay hidden from the rest of the program."
      size="lg"
      footer={
        <Button variant="primary" loading={busy} onClick={save}>
          {canProfile ? 'Save' : 'Done'}
        </Button>
      }
    >
      <div className="space-y-5">
        {canProfile && (
          <NameFields value={n} onChange={setN} />
        )}
        {canTeams && (
          <section className="space-y-2">
            <div>
              <p className="text-[13px] font-medium">{isMultiTeam() ? 'Teams and roles' : 'Role'}</p>
              <p className="text-[12px] text-muted">{isMultiTeam() ? 'Saved as soon as you change them. To move someone, add them to the new team, then remove them from the old one.' : 'Saved as soon as you change it.'}</p>
            </div>
            <TeamsDialog p={p} onClose={onClose} embedded />
          </section>
        )}
        {canProfile &&
          fields.map((f) => (
            <div key={f.id} className="space-y-1.5" role="group" aria-label={f.label}>
              <p className="flex items-center gap-1 text-[13px] font-medium">
                {f.label} {f.private && <Lock className="size-3 text-warning" aria-label={f.level === 'leaders' ? 'Team leaders only' : 'Mentors only'} />}
              </p>
              <ProfileFieldInput field={f} value={values[f.id] ?? ''} onChange={(v) => setValues({ ...values, [f.id]: v })} />
            </div>
          ))}
      </div>
    </Dialog>
  );
}
