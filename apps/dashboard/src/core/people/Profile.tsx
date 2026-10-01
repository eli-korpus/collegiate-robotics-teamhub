import { Suspense, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, KeyRound, Lock, MoreHorizontal, Shield, Trash2, UserCheck, UserX } from 'lucide-react';
import { Avatar, Button, Card, CardHeader, Dialog, EmptyState, IconButton, Input, Menu, PositionBadge, Select, Spinner, TYPE_LABEL, toast, useConfirm } from '@teamhub/ui';
import { canWith, friendlyError, isMultiTeam, runtime, useMe, usePeople, useSupabase, TeamBadge } from '@teamhub/sdk';
import { useProfileFields } from '../home/coreWidgets';
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
          <PersonActions userId={p.id} />
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title={isMultiTeam() ? 'Teams' : 'Team'} />
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
        <ProfileFieldsCard userId={p.id} details={p.details} />
        {runtime().modules.flatMap((m) =>
          (m.client.profileSections ?? [])
            .filter((s) => !s.perm || isSelf || canWith(me, s.perm))
            .map((s) => {
              const C = s.component;
              return (
                <Card key={`${m.manifest.id}:${s.id}`}>
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

function ProfileFieldsCard({ userId, details }: { userId: string; details: Record<string, string> }) {
  const sb = useSupabase();
  const me = useMe();
  const fields = useProfileFields();
  const priv = useQuery({
    queryKey: ['core', 'private', userId],
    queryFn: async () => {
      const { data } = await sb.from('profiles_private').select('data').eq('user_id', userId).maybeSingle();
      return (data?.data ?? null) as Record<string, string> | null;
    },
  });
  const canPrivate = userId === me.id || priv.data != null;
  if (!fields.length) return null;
  return (
    <Card>
      <CardHeader title="Profile" />
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 px-4 pb-4 text-[13.5px]">
        {fields
          .filter((f) => !f.private || canPrivate)
          .map((f) => (
            <div key={f.id} className="contents">
              <dt className="flex items-center gap-1 text-muted">
                {f.label} {f.private && <Lock className="size-3 text-warning" aria-label="Private" />}
              </dt>
              <dd>{(f.private ? priv.data?.[f.id] : details[f.id]) || <span className="text-faint">—</span>}</dd>
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
