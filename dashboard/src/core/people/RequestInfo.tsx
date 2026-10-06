import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Lock, Plus, Trash2 } from 'lucide-react';
import { Banner, Button, Card, Checkbox, Dialog, EmptyState, Field, IconButton, Input, RelativeTime, Textarea, VisibilityNote, toast, useConfirm } from '@teamhub/ui';
import { friendlyError, useMe, useSupabase, Person, TeamBadge, TeamScopePicker } from '@teamhub/sdk';
import { useProfileFields } from '../home/coreWidgets';

interface InfoRequest {
  id: string;
  fields: string[];
  team_id: string | null;
  message: string | null;
  created_by: string;
  created_at: string;
  closes_at: string | null;
}

/**
 * THE way to collect personal info (spec §12.2): members get a Home card and answers are written to their profile.
 * No response rows: completion is derived from the profile itself.
 */
export function RequestInfo() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const me = useMe();
  const confirm = useConfirm();
  const fields = useProfileFields();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [team, setTeam] = useState<string | null>(null);
  const [closes, setCloses] = useState('');
  const reqs = useQuery({
    queryKey: ['core', 'info-requests'],
    queryFn: async () => {
      const { data, error } = await sb.from('info_requests').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as InfoRequest[];
    },
  });

  if (!fields.length) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Banner tone="info" title="No profile fields to request">
          Profile fields (shirt size, subteam, emergency contact …) are chosen in the setup wizard. Add some there, then you can request them here.
        </Banner>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted">Ask members to fill in profile fields. Answers go straight to their profile with that field’s normal privacy.</p>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
          Request info
        </Button>
      </div>
      {!reqs.data?.length ? (
        <EmptyState icon={<ClipboardList />} title="No requests yet" body="Use this instead of a poll whenever you need personal info like shirt sizes." />
      ) : (
        reqs.data.map((r) => <RequestCard key={r.id} r={r} labels={Object.fromEntries(fields.map((f) => [f.id, f.label]))} onDelete={async () => {
          if (!(await confirm({ title: 'Delete this request?', body: 'Answers already saved to profiles stay there.', confirmLabel: 'Delete', danger: true }))) return;
          const { error } = await sb.from('info_requests').delete().eq('id', r.id);
          if (error) toast.error(friendlyError(error));
          qc.invalidateQueries({ queryKey: ['core', 'info-requests'] });
        }} canDelete={r.created_by === me.id || me.isAdmin} />)
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Request info from members"
        footer={
          <Button
            variant="primary"
            disabled={!picked.length}
            onClick={async () => {
              const { error } = await sb.from('info_requests').insert({
                fields: picked,
                message: message.trim() || null,
                team_id: team,
                closes_at: closes ? new Date(closes).toISOString() : null,
                created_by: me.id,
              });
              if (error) return toast.error(friendlyError(error));
              toast.success('Request sent. Members will see it on Home');
              setOpen(false);
              setPicked([]);
              setMessage('');
              qc.invalidateQueries({ queryKey: ['core', 'info-requests'] });
            }}
          >
            Send request
          </Button>
        }
      >
        <div className="space-y-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13px] font-medium">Which fields?</legend>
            {fields.map((f) => (
              <Checkbox
                key={f.id}
                checked={picked.includes(f.id)}
                onChange={(v) => setPicked(v ? [...picked, f.id] : picked.filter((x) => x !== f.id))}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    {f.label} {f.private && <Lock className="size-3 text-warning" aria-label="private" />}
                  </span>
                }
              />
            ))}
          </fieldset>
          <Field label="Message" optional>
            {(id) => <Textarea id={id} rows={2} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Ordering team shirts on Friday" />}
          </Field>
          <Field label="Deadline" optional>
            {(id) => <Input id={id} type="date" value={closes} onChange={(e) => setCloses(e.target.value)} />}
          </Field>
          <TeamScopePicker value={team} onChange={setTeam} perm="people.request_info" label="Ask" />
          <VisibilityNote locked={picked.some((p) => fields.find((f) => f.id === p)?.private)}>
            Each answer keeps its field’s privacy: private fields are visible only to the person and mentors.
          </VisibilityNote>
        </div>
      </Dialog>
    </div>
  );
}

function RequestCard({ r, labels, onDelete, canDelete }: { r: InfoRequest; labels: Record<string, string>; onDelete: () => void; canDelete: boolean }) {
  const sb = useSupabase();
  const status = useQuery({
    queryKey: ['core', 'info-status', r.id],
    queryFn: async () => {
      const { data, error } = await sb.rpc('info_request_status', { p_request: r.id });
      if (error) throw error;
      return data as { user_id: string; missing: string[] }[];
    },
  });
  const missing = (status.data ?? []).filter((s) => s.missing.length);
  const total = status.data?.length ?? 0;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{r.fields.map((f) => labels[f] ?? f).join(', ')}</p>
          <p className="text-[12.5px] text-muted">
            <TeamBadge teamId={r.team_id} /> Requested <RelativeTime date={r.created_at} />
            {r.closes_at && ` · due ${new Date(r.closes_at).toLocaleDateString()}`}
          </p>
          {r.message && <p className="mt-1 text-[13px]">“{r.message}”</p>}
        </div>
        <span className="tabular text-[13px] font-semibold">{total - missing.length}/{total} done</span>
        {canDelete && (
          <IconButton label="Delete request" size="sm" onClick={onDelete}>
            <Trash2 className="size-4" />
          </IconButton>
        )}
      </div>
      {missing.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[12px] font-medium text-muted">Still missing ({missing.length})</p>
          <ul className="flex flex-wrap gap-2">
            {missing.map((m) => (
              <li key={m.user_id}>
                <Person id={m.user_id} size="sm" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
