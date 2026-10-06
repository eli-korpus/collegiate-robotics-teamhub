import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, Check, ExternalLink, PackageCheck, ShoppingCart, Trash2, Truck } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  Input,
  ListRow,
  RelativeTime,
  Segmented,
  Select,
  Sheet,
  SmartGroupList,
  Spinner,
  StatusPill,
  Textarea,
  hostOf,
  toast,
  useConfirm,
  safeHref,
} from '@teamhub/ui';
import {
  canWith,
  CommentThread,
  friendlyError,
  ModuleHeader,
  ModuleNewMenu,
  ModulePurpose,
  Person,
  PersonName,
  ScopeVisibility,
  Slot,
  TeamBadge,
  TeamScopePicker,
  useCan,
  useCreateShortcut,
  useMe,
  useNewParam,
  useRows,
  useSelectedParam,
  useSupabase,
  useTeamScope,
} from '@teamhub/sdk';

export type PStatus = 'requested' | 'ordered' | 'received' | 'declined';
export interface PRequest {
  id: string;
  team_id: string | null;
  item: string;
  url: string | null;
  qty: number;
  est_price: number | null;
  reason: string | null;
  urgency: number;
  status: PStatus;
  requested_by: string | null;
  handled_by: string | null;
  ordered_at: string | null;
  received_at: string | null;
  note: string | null;
  created_at: string;
}

export const P_STATUS: Record<PStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' }> = {
  requested: { label: 'Needs ordering', tone: 'neutral' },
  ordered: { label: 'Ordered', tone: 'info' },
  received: { label: 'Received', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
};
const URGENCY = ['Whenever', 'Soon', 'Urgent'];

export const useRequests = () => useRows<PRequest>(['purchases', 'list'], (sb) => sb.from('pur_requests').select('*').order('urgency', { ascending: false }).order('created_at', { ascending: false }));
const money = (n: number | null) => (n == null ? '' : `$${Number(n).toFixed(2)}`);

export default function PurchasesRoutes() {
  const list = useRequests();
  const scope = useTeamScope();
  const canRequest = useCan('purchases.request');
  const canOrder = useCan('purchases.order');
  const [view, setView] = useState<'status' | 'vendor'>('status');
  const [creating, setCreating, params] = useNewParam();
  const [selected, setSelected] = useSelectedParam();
  useCreateShortcut(() => setCreating(true), canRequest);
  const rows = (list.data ?? []).filter((r) => !scope || !r.team_id || r.team_id === scope);
  const current = rows.find((r) => r.id === selected) ?? null;
  const row = (r: PRequest) => (
    <ListRow selected={r.id === selected} onClick={() => setSelected(r.id)}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium">
          {r.qty > 1 && <span className="text-muted">{r.qty}× </span>}
          {r.item}
        </p>
        <p className="text-[12px] text-muted">
          <PersonName id={r.requested_by} /> · <RelativeTime date={r.created_at} />
          {r.url && ` · ${hostOf(r.url)}`}
        </p>
      </div>
      {r.urgency === 2 && r.status === 'requested' && <Badge tone="danger">Urgent</Badge>}
      {r.est_price != null && <span className="tabular text-[12.5px] text-muted">{money(r.est_price * r.qty)}</span>}
      <StatusPill label={P_STATUS[r.status].label} tone={P_STATUS[r.status].tone} />
    </ListRow>
  );
  const groups =
    view === 'vendor'
      ? [...new Set(rows.filter((r) => r.status === 'requested').map((r) => (r.url ? hostOf(r.url) : 'No link')))].map((v) => ({
          id: v,
          title: v,
          items: rows.filter((r) => r.status === 'requested' && (r.url ? hostOf(r.url) : 'No link') === v),
        }))
      : (['requested', 'ordered', 'received', 'declined'] as PStatus[]).map((s) => ({ id: s, title: P_STATUS[s].label, items: rows.filter((r) => r.status === s), collapsed: s === 'declined' || s === 'received' }));

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader moduleId="purchases" actions={canRequest && <ModuleNewMenu moduleId="purchases" label="Request a purchase" onNew={() => setCreating(true)} />}>
        {canOrder && (
          <Segmented
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'status', label: 'By status' },
              { value: 'vendor', label: 'To order, by vendor' },
            ]}
          />
        )}
      </ModuleHeader>
      <div className="min-h-0 flex-1 relative overflow-y-auto">
        {list.isLoading ? (
          <Spinner className="m-8" />
        ) : (
          <SmartGroupList
            groups={groups}
            keyOf={(r) => r.id}
            render={row}
            empty={<EmptyState icon={<ShoppingCart />} title="No purchase requests" body={<ModulePurpose moduleId="purchases" compact className="mt-2 text-left" />} action={canRequest && <Button onClick={() => setCreating(true)}>Request something</Button>} />}
          />
        )}
      </div>
      {creating && (
        <RequestDialog
          onClose={() => setCreating(false)}
          draft={{ item: params.get('item') ?? '', url: params.get('url') ?? '', qty: Number(params.get('qty')) || 1, reason: params.get('reason') ?? '' }}
        />
      )}
      {current && <RequestSheet r={current} onClose={() => setSelected(null)} />}
    </div>
  );
}

function RequestDialog({ onClose, draft, existing }: { onClose: () => void; draft?: { item: string; url: string; qty: number; reason: string }; existing?: PRequest }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const scope = useTeamScope();
  const [v, setV] = useState({
    item: existing?.item ?? draft?.item ?? '',
    url: existing?.url ?? draft?.url ?? '',
    qty: existing?.qty ?? draft?.qty ?? 1,
    est_price: existing?.est_price != null ? String(existing.est_price) : '',
    reason: existing?.reason ?? draft?.reason ?? '',
    urgency: existing?.urgency ?? 1,
    team_id: existing ? existing.team_id : scope,
  });
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(x) => !x && onClose()}
      title={existing ? 'Edit request' : 'Request a purchase'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              if (!v.item.trim()) return toast.error('What should be bought?');
              if (v.url && !/^https?:\/\//.test(v.url)) return toast.error('Links must start with https://');
              setBusy(true);
              const row = { ...v, item: v.item.trim(), url: v.url.trim() || null, est_price: v.est_price === '' ? null : Number(v.est_price), reason: v.reason.trim() || null };
              const res = existing ? await sb.from('pur_requests').update(row).eq('id', existing.id) : await sb.from('pur_requests').insert({ ...row, requested_by: me.id });
              setBusy(false);
              if (res.error) return toast.error(friendlyError(res.error));
              qc.invalidateQueries({ queryKey: ['purchases'] });
              toast.success(existing ? 'Request updated' : 'Request sent to the people who order');
              onClose();
            }}
          >
            {existing ? 'Save' : 'Send request'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!existing && <ModulePurpose moduleId="purchases" compact />}
        <TeamScopePicker value={v.team_id} onChange={(team_id) => setV({ ...v, team_id })} perm="purchases.request" label="For" />
        <Field label="Item" required>{(id) => <Input id={id} autoFocus maxLength={200} value={v.item} onChange={(e) => setV({ ...v, item: e.target.value })} placeholder="e.g. goBILDA 5203 motor 312 RPM" />}</Field>
        <Field label="Link" optional>{(id) => <Input id={id} type="url" placeholder="https://" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} />}</Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Quantity" required>{(id) => <Input id={id} type="number" min={1} value={v.qty} onChange={(e) => setV({ ...v, qty: Number(e.target.value) || 1 })} />}</Field>
          <Field label="Est. price each" optional>{(id) => <Input id={id} type="number" min={0} step="0.01" value={v.est_price} onChange={(e) => setV({ ...v, est_price: e.target.value })} />}</Field>
          <Field label="How soon">
            {(id) => (
              <Select id={id} value={v.urgency} onChange={(e) => setV({ ...v, urgency: Number(e.target.value) })}>
                {URGENCY.map((u, i) => (
                  <option key={u} value={i}>
                    {u}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Why do we need it?" optional>{(id) => <Textarea id={id} rows={2} maxLength={1000} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} />}</Field>
        <ScopeVisibility teamId={v.team_id} />
      </div>
    </Dialog>
  );
}

function RequestSheet({ r, onClose }: { r: PRequest; onClose: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(r.note ?? '');
  const canOrder = canWith(me, 'purchases.order', r.team_id);
  const canDecline = canWith(me, 'purchases.decline', r.team_id);
  const own = r.requested_by === me.id && r.status === 'requested';
  const set = async (status: PStatus) => {
    const { error } = await sb.from('pur_requests').update({ status, note: note || null }).eq('id', r.id);
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['purchases'] });
  };
  if (editing) return <RequestDialog existing={r} onClose={() => setEditing(false)} />;
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={r.item}>
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={P_STATUS[r.status].label} tone={P_STATUS[r.status].tone} />
          <Badge>×{r.qty}</Badge>
          {r.est_price != null && <Badge>{money(r.est_price)} each · {money(r.est_price * r.qty)} total</Badge>}
          <Badge tone={r.urgency === 2 ? 'danger' : 'neutral'}>{URGENCY[r.urgency]}</Badge>
          <TeamBadge teamId={r.team_id} />
        </div>
        {r.url && (
          <a href={safeHref(r.url)} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[13.5px] font-medium text-accent hover:underline">
            {hostOf(r.url)} <ExternalLink className="size-3.5" />
          </a>
        )}
        {r.reason && <p className="text-[13.5px]">{r.reason}</p>}
        <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-[13px]">
          <dt className="text-muted">Requested by</dt>
          <dd className="flex items-center gap-2">
            <Person id={r.requested_by} size="sm" /> <RelativeTime date={r.created_at} className="text-faint" />
          </dd>
          {r.handled_by && (
            <>
              <dt className="text-muted">Handled by</dt>
              <dd>
                <Person id={r.handled_by} size="sm" />
              </dd>
            </>
          )}
          {r.ordered_at && (
            <>
              <dt className="text-muted">Ordered</dt>
              <dd>{new Date(r.ordered_at).toLocaleDateString()}</dd>
            </>
          )}
          {r.received_at && (
            <>
              <dt className="text-muted">Received</dt>
              <dd>{new Date(r.received_at).toLocaleDateString()}</dd>
            </>
          )}
          {r.note && !canOrder && (
            <>
              <dt className="text-muted">Note</dt>
              <dd>{r.note}</dd>
            </>
          )}
        </dl>
        {(canOrder || canDecline) && (
          <div className="space-y-2">
            <Field label="Note to the requester" optional>{(id) => <Input id={id} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="e.g. arriving Thursday" />}</Field>
            <div className="flex flex-wrap gap-2">
              {canOrder && r.status === 'requested' && (
                <Button variant="primary" icon={<Truck className="size-4" />} onClick={() => set('ordered')}>
                  Mark ordered
                </Button>
              )}
              {canOrder && ['requested', 'ordered'].includes(r.status) && (
                <Button icon={<PackageCheck className="size-4" />} onClick={() => set('received')}>
                  Mark received
                </Button>
              )}
              {canDecline && r.status === 'requested' && (
                <Button variant="ghost" icon={<Ban className="size-4" />} onClick={() => set('declined')}>
                  Decline
                </Button>
              )}
              {r.status !== 'requested' && (
                <Button variant="ghost" icon={<Check className="size-4" />} onClick={() => set('requested')}>
                  Back to “needs ordering”
                </Button>
              )}
            </div>
          </div>
        )}
        <Slot name="purchases.request.actions" props={{ request: r }} wrap={(c) => <div className="flex flex-wrap gap-2">{c}</div>} />
        <div className="flex gap-2">
          {own && <Button onClick={() => setEditing(true)}>Edit</Button>}
          {(own || canOrder) && (
            <Button
              variant="ghost"
              className="text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (!(await confirm({ title: 'Delete this request?', danger: true, confirmLabel: 'Delete' }))) return;
                const { error } = await sb.from('pur_requests').delete().eq('id', r.id);
                if (error) return toast.error(friendlyError(error));
                qc.invalidateQueries({ queryKey: ['purchases'] });
                onClose();
              }}
            >
              Delete
            </Button>
          )}
        </div>
        <CommentThread refStr={`purchases:request:${r.id}`} />
      </div>
    </Sheet>
  );
}
