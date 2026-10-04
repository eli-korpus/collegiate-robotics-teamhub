import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, UserPlus, X } from 'lucide-react';
import { Avatar, Button, Checkbox, Dialog, EmptyState, RelativeTime, Segmented, TYPE_LABEL, toast, useConfirm, VisibilityNote } from '@teamhub/ui';
import { canWith, friendlyError, runtime, useMe, usePeople, usePositions, useSupabase, TeamBadge, type Membership, type PersonInfo } from '@teamhub/sdk';
import { ProfileFieldInput, useProfileFields } from '../home/coreWidgets';

type T = 'member' | 'captain' | 'mentor';

/** Pending signups with tiered approve/adjust/reject (spec §7.5). */
export function Requests() {
  const people = usePeople();
  const me = useMe();
  const rows = [...(people.data?.values() ?? [])].flatMap((p) => p.memberships.filter((m) => m.status === 'pending').map((m) => ({ p, m })));
  const [approving, setApproving] = useState<{ p: PersonInfo; m: Membership } | null>(null);
  const sb = useSupabase();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const reject = async (p: PersonInfo, m: Membership) => {
    if (!(await confirm({ title: `Reject ${p.name}?`, body: 'Their request is removed. If they have no other teams, their account is deleted.', danger: true, confirmLabel: 'Reject' }))) return;
    const { data, error } = await sb.rpc('people_reject', { p_user: p.id, p_team: m.team_id });
    if (error) return toast.error(friendlyError(error));
    if (data === true) {
      const res = await sb.functions.invoke('admin-delete-user', { body: { user_id: p.id } });
      if (res.error) toast.warning('Request rejected, but the account could not be deleted automatically.');
    }
    toast.success('Request rejected');
    qc.invalidateQueries({ queryKey: ['core'] });
  };

  if (!rows.length) return <EmptyState icon={<UserPlus />} title="No pending requests" body="When someone signs up on the Join page, their request shows up here." />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {rows.map(({ p, m }) => {
          const req = (m.requested_type ?? m.type) as T;
          const allowed = canWith(me, req === 'member' ? 'people.approve_members' : 'people.approve_leaders', m.team_id);
          return (
            <li key={p.id + m.team_id} className="flex flex-wrap items-start gap-3 p-4">
              <Avatar name={p.name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{p.name}</p>
                <p className="text-[12.5px] text-muted">
                  Wants to join as <strong className="font-medium text-fg">{TYPE_LABEL[req]}</strong> <TeamBadge teamId={m.team_id} /> {m.created_at && <> · <RelativeTime date={m.created_at} /></>}
                </p>
                {m.note && <p className="mt-1.5 rounded-md bg-bg-subtle px-2.5 py-1.5 text-[13px]">“{m.note}”</p>}
                {!allowed && <p className="mt-1 text-[12px] text-warning">Only mentors or admins can approve {TYPE_LABEL[req]} requests.</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" icon={<X className="size-4" />} onClick={() => reject(p, m)} disabled={!allowed}>
                  Reject
                </Button>
                <Button size="sm" variant="primary" icon={<Check className="size-4" />} onClick={() => setApproving({ p, m })} disabled={!allowed}>
                  Approve…
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {approving && <ApproveDialog p={approving.p} m={approving.m} onClose={() => setApproving(null)} />}
    </div>
  );
}

function ApproveDialog({ p, m, onClose }: { p: PersonInfo; m: Membership; onClose: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const positions = usePositions();
  const fields = useProfileFields().filter((f) => !f.private);
  const [type, setType] = useState<T>((m.requested_type ?? m.type) as T);
  const [pos, setPos] = useState<string[]>([]);
  const [details, setDetails] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const canLeaders = canWith(me, 'people.approve_leaders', m.team_id);
  const assignable = (positions.data ?? []).filter(
    (x) => (!x.team_id || x.team_id === m.team_id) && (canWith(me, 'people.assign_positions', x.team_id) || (!x.grants_permissions && canWith(me, 'people.assign_badges', x.team_id))),
  );
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={`Approve ${p.name}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const clean = Object.fromEntries(Object.entries(details).filter(([, v]) => v));
              const { error } = await sb.rpc('people_approve', { p_user: p.id, p_team: m.team_id, p_type: type, p_positions: pos, p_details: Object.keys(clean).length ? clean : null });
              setBusy(false);
              if (error) return toast.error(friendlyError(error));
              toast.success(`${p.name} is in!`);
              qc.invalidateQueries({ queryKey: ['core'] });
              onClose();
            }}
          >
            Approve
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium">Profile type</p>
          <Segmented<T>
            value={type}
            onChange={setType}
            options={[
              { value: 'member', label: 'Member' },
              ...(canLeaders ? [{ value: 'captain' as T, label: 'Captain' }, { value: 'mentor' as T, label: 'Mentor' }] : []),
            ]}
          />
        </div>
        {assignable.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">Positions (optional)</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {assignable.map((x) => (
                <Checkbox key={x.id} checked={pos.includes(x.id)} onChange={(v) => setPos(v ? [...pos, x.id] : pos.filter((y) => y !== x.id))} label={x.name} />
              ))}
            </div>
          </div>
        )}
        {fields.length > 0 && (
          <div className="space-y-2">
            <p className="text-[13px] font-medium">Profile details (optional)</p>
            {fields.map((f) => (
              <label key={f.id} className="grid grid-cols-[120px_1fr] items-center gap-2 text-[13px]">
                <span className="text-muted">{f.label}</span>
                <ProfileFieldInput field={f} value={details[f.id] ?? ''} onChange={(v) => setDetails({ ...details, [f.id]: v })} />
              </label>
            ))}
            <VisibilityNote>These fields are visible to {runtime().config.program.name}.</VisibilityNote>
          </div>
        )}
      </div>
    </Dialog>
  );
}
