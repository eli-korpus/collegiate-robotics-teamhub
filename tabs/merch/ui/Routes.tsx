import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FIELD_TABLE, fieldLevel } from '@teamhub/config-schema/util';
import { Download, Minus, Plus, Shirt, Trash2, X } from 'lucide-react';
import {
  Avatar,
  Banner,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  ListRow,
  Select,
  SmartGroupList,
  Spinner,
  StatusPill,
  Textarea,
  downloadText,
  formatDate,
  toCsv,
  TagListInput,
  toDateTimeInput,
  toast,
  useConfirm,
  validateRequired,
} from '@teamhub/ui';
import {
  canWith,
  friendlyError,
  ModuleHeader,
  ModulePurpose,
  runtime,
  ScopeVisibility,
  TeamBadge,
  TeamScopePicker,
  useCan,
  useCreateShortcut,
  useMe,
  useNewParam,
  usePeople,
  useSelectedParam,
  useSession,
  useSupabase,
  useTeamScope,
} from '@teamhub/sdk';
import { isOpen, tally, useDrives, useOrders, type Drive, type Line, type MerchItem, type Order } from './data';

export default function MerchRoutes() {
  const drives = useDrives();
  const orders = useOrders();
  const scope = useTeamScope();
  const me = useMe();
  const canManage = useCan('merch.manage');
  const [creating, setCreating] = useNewParam();
  const [selected, setSelected] = useSelectedParam();
  useCreateShortcut(() => setCreating(true), canManage);
  const list = (drives.data ?? []).filter((d) => !scope || !d.team_id || d.team_id === scope);
  const current = list.find((d) => d.id === selected) ?? null;
  const mine = (d: Drive) => orders.data?.find((o) => o.drive_id === d.id && o.user_id === me.id);
  return (
    <div>
      <ModuleHeader moduleId="merch" actions={canManage && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New order drive</Button>} />
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        {drives.isLoading ? (
          <Spinner />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <SmartGroupList
              groups={[
                { id: 'open', title: 'Taking orders', items: list.filter(isOpen) },
                { id: 'done', title: 'Closed', items: list.filter((d) => !isOpen(d)), collapsed: true },
              ]}
              keyOf={(d) => d.id}
              empty={<EmptyState icon={<Shirt />} title="No merch orders right now" body={<ModulePurpose moduleId="merch" compact className="mt-2 text-left" />} />}
              render={(d) => {
                const o = mine(d);
                return (
                  <ListRow onClick={() => setSelected(d.id)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium">{d.title}</p>
                      <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                        <span>{d.items.map((i) => i.name).join(', ')}</span>
                        {d.closes_at && isOpen(d) && <span>· closes {formatDate(d.closes_at)}</span>}
                        <TeamBadge teamId={d.team_id} />
                      </p>
                    </div>
                    {o ? <StatusPill label={o.delivered ? 'Delivered' : o.paid ? 'Ordered · paid' : 'Ordered'} tone="success" /> : d.status === 'delivered' ? <StatusPill label="Delivered" /> : null}
                  </ListRow>
                );
              }}
            />
          </div>
        )}
      </div>
      {creating && <DriveEditor drive={null} onClose={() => setCreating(false)} />}
      {current && <DriveDialog drive={current} orders={(orders.data ?? []).filter((o) => o.drive_id === current.id)} onClose={() => setSelected(null)} />}
    </div>
  );
}

function DriveDialog({ drive: d, orders, onClose }: { drive: Drive; orders: Order[]; onClose: () => void }) {
  const me = useMe();
  const [editing, setEditing] = useState(false);
  const manage = canWith(me, 'merch.manage', d.team_id) || canWith(me, 'merch.mark_paid', d.team_id);
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  if (editing) return <DriveEditor drive={d} onClose={() => setEditing(false)} />;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={d.title}
      description={isOpen(d) ? (d.closes_at ? `Orders close ${new Date(d.closes_at).toLocaleString()}` : 'Taking orders') : d.status === 'delivered' ? 'Delivered' : 'Orders closed'}
      size="lg"
      footer={canWith(me, 'merch.manage', d.team_id) && <Button onClick={() => setEditing(true)}>Edit drive</Button>}
    >
      <div className="space-y-4">
        {d.description && <p className="whitespace-pre-wrap text-[13.5px]">{d.description}</p>}
        <Banner tone="info">Payment is collected outside TeamHub (cash, check or your school's system). A mentor marks orders paid here.</Banner>
        {manage && (
          <div className="flex gap-1 border-b border-border">
            {(['mine', 'all'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-1.5 text-[13px] ${tab === t ? 'border-accent font-medium' : 'border-transparent text-muted'}`}>
                {t === 'mine' ? 'My order' : `All orders (${orders.length})`}
              </button>
            ))}
          </div>
        )}
        {tab === 'mine' || !manage ? <MyOrder drive={d} order={orders.find((o) => o.user_id === me.id) ?? null} /> : <AllOrders drive={d} orders={orders} />}
      </div>
    </Dialog>
  );
}

/** The profile field used for sizes, if the program has one (spec §13.28: single source of truth). */
function sizeField() {
  return runtime().config.profileFields.find((f) => f.id === 'shirt_size' || /shirt/i.test(f.label)) ?? null;
}

/** Your own answers in the size field's storage (on your profile, or in the team-only or mentors-only table). */
function useMySizeStore() {
  const sb = useSupabase();
  const me = useMe();
  const field = sizeField();
  const level = field ? fieldLevel(field) : 'everyone';
  const q = useQuery({
    queryKey: ['core', 'private', me.id, 'merch-size'],
    enabled: !!field && level !== 'everyone',
    queryFn: async () => {
      const { data } = await sb.from(FIELD_TABLE[level]).select('data').eq('user_id', me.id).maybeSingle();
      return (data?.data ?? {}) as Record<string, string>;
    },
  });
  const current = level === 'everyone' ? (me.profile.details ?? {}) : (q.data ?? {});
  const save = async (size: string) => {
    const next = { ...current, [field!.id]: size };
    return level === 'everyone'
      ? sb.from('profiles').update({ details: next }).eq('id', me.id)
      : sb.from(FIELD_TABLE[level]).upsert({ user_id: me.id, data: next });
  };
  return { field, size: field ? (current[field.id] ?? '') : '', loading: level !== 'everyone' && q.isLoading, save };
}

function MyOrder({ drive: d, order }: { drive: Drive; order: Order | null }) {
  const sb = useSupabase();
  const me = useMe();
  const { refreshMe } = useSession();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const store = useMySizeStore();
  const field = store.field;
  const profileSize = store.size;
  const [lines, setLines] = useState<Line[]>(order?.lines ?? []);
  const [askSize, setAskSize] = useState('');
  const open = isOpen(d);
  const canOrder = open && canWith(me, 'merch.order', d.team_id);
  const qty = (item: string, size: string | null) => lines.find((l) => l.item === item && l.size === size)?.qty ?? 0;
  const setQty = (item: string, size: string | null, n: number) => {
    const rest = lines.filter((l) => !(l.item === item && l.size === size));
    setLines(n > 0 ? [...rest, { item, size, qty: Math.min(20, n) }] : rest);
  };
  const needsSize = !!field && !store.loading && !profileSize && d.items.some((i) => i.sizes.length);
  const save = async () => {
    if (!validateRequired()) return;
    if (needsSize && askSize) {
      const { error } = await store.save(askSize);
      if (error) return toast.error(friendlyError(error));
      refreshMe();
      qc.invalidateQueries({ queryKey: ['core', 'private', me.id] });
    }
    const { error } = order ? await sb.from('mer_orders').update({ lines }).eq('id', order.id) : await sb.from('mer_orders').insert({ drive_id: d.id, user_id: me.id, lines });
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['merch'] });
    toast.success(order ? 'Order updated' : 'Order placed');
  };
  const sizeFor = (i: MerchItem) => (i.sizes.includes(askSize || profileSize) ? askSize || profileSize : i.sizes[0] ?? null);
  return (
    <div className="space-y-3">
      {order && (
        <div className="flex flex-wrap gap-2">
          <StatusPill label={order.paid ? 'Paid' : 'Not paid yet'} tone={order.paid ? 'success' : 'warning'} />
          {order.delivered && <StatusPill label="Delivered" tone="success" />}
        </div>
      )}
      {needsSize && canOrder && (
        <Field label={`Your ${field!.label.toLowerCase()}`} hint="Saved to your profile so you're never asked again">
          {(id) =>
            field!.type === 'select' && field!.options.length ? (
              <Select id={id} value={askSize} onChange={(e) => setAskSize(e.target.value)} className="w-40">
                <option value="">Choose…</option>
                {field!.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            ) : (
              <Input id={id} className="w-40" value={askSize} onChange={(e) => setAskSize(e.target.value)} />
            )
          }
        </Field>
      )}
      {profileSize && <p className="text-[12.5px] text-muted">Your profile size: <strong>{profileSize}</strong> (pre-selected below).</p>}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {d.items.map((i) => {
          const sizes = i.sizes.length ? i.sizes : [null];
          const shown = sizes.filter((s) => qty(i.id, s) > 0);
          return (
            <li key={i.id} className="space-y-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[14px] font-medium">{i.name}</span>
                {i.price && <span className="text-[13px] text-muted">{i.price}</span>}
              </div>
              {(shown.length ? shown : canOrder ? [sizeFor(i)] : []).map((s) => (
                <div key={s ?? 'one'} className="flex items-center gap-2 text-[13px]">
                  {i.sizes.length ? (
                    <Select
                      aria-label={`${i.name} size`}
                      className="w-28"
                      disabled={!canOrder}
                      value={s ?? ''}
                      onChange={(e) => {
                        const n = qty(i.id, s);
                        const rest = lines.filter((l) => !(l.item === i.id && l.size === s));
                        setLines(n ? [...rest, { item: i.id, size: e.target.value, qty: n }] : rest);
                      }}
                    >
                      {i.sizes.map((z) => (
                        <option key={z}>{z}</option>
                      ))}
                    </Select>
                  ) : (
                    <span className="w-28 text-muted">One size</span>
                  )}
                  <IconButton label="Fewer" size="sm" disabled={!canOrder || qty(i.id, s) === 0} onClick={() => setQty(i.id, s, qty(i.id, s) - 1)}>
                    <Minus className="size-3.5" />
                  </IconButton>
                  <span className="tabular w-6 text-center">{qty(i.id, s)}</span>
                  <IconButton label="More" size="sm" disabled={!canOrder} onClick={() => setQty(i.id, s, qty(i.id, s) + 1)}>
                    <Plus className="size-3.5" />
                  </IconButton>
                </div>
              ))}
              {canOrder && i.sizes.length > 1 && shown.length > 0 && (
                <button type="button" className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline" onClick={() => setQty(i.id, i.sizes.find((z) => !qty(i.id, z)) ?? i.sizes[0], 1)}>
                  <Plus className="size-3.5" /> Another size
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {canOrder ? (
        <div className="flex gap-2">
          {order && !order.paid && (
            <Button
              variant="ghost"
              className="text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (!(await confirm({ title: 'Cancel your order?', danger: true, confirmLabel: 'Cancel order' }))) return;
                await sb.from('mer_orders').delete().eq('id', order.id);
                setLines([]);
                qc.invalidateQueries({ queryKey: ['merch'] });
              }}
            >
              Cancel order
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="primary" onClick={save} disabled={!lines.length || (needsSize && !askSize)}>
            {order ? 'Update order' : 'Place order'}
          </Button>
        </div>
      ) : (
        !order && <p className="text-[13px] text-faint">{open ? "You can't order from this drive." : 'Orders are closed.'}</p>
      )}
    </div>
  );
}

function AllOrders({ drive: d, orders }: { drive: Drive; orders: Order[] }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const people = usePeople();
  const canPaid = canWith(me, 'merch.mark_paid', d.team_id);
  const canManage = canWith(me, 'merch.manage', d.team_id);
  const name = (id: string) => people.data?.get(id)?.name ?? 'Former member';
  const itemName = (id: string) => d.items.find((i) => i.id === id)?.name ?? id;
  const describe = (o: Order) => o.lines.map((l) => `${l.qty}× ${itemName(l.item)}${l.size ? ` (${l.size})` : ''}`).join(', ');
  const set = async (o: Order, patch: Partial<Order>) => {
    const { error } = await sb.from('mer_orders').update(patch).eq('id', o.id);
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['merch'] });
  };
  const totals = tally(d, orders);
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">What to order</h3>
        <div className="flex flex-wrap gap-2">
          {totals.map((t) => (
            <span key={t.item.id + (t.size ?? '')} className="rounded-md border border-border px-2 py-1 text-[13px]">
              <span className="tabular font-semibold">{t.qty}</span> × {t.item.name}
              {t.size && <span className="text-muted"> · {t.size}</span>}
            </span>
          ))}
          {!totals.length && <span className="text-[13px] text-faint">No orders yet.</span>}
        </div>
      </section>
      <div className="flex items-center">
        <span className="flex-1 text-[12.5px] text-muted">
          {orders.filter((o) => o.paid).length}/{orders.length} paid · {orders.filter((o) => o.delivered).length} delivered
        </span>
        <Button
          size="sm"
          variant="ghost"
          icon={<Download className="size-4" />}
          onClick={() => downloadText(toCsv([['Name', 'Order', 'Paid', 'Delivered'], ...orders.map((o) => [name(o.user_id), describe(o), o.paid ? 'yes' : 'no', o.delivered ? 'yes' : 'no'])]), `${d.title}.csv`, 'text/csv')}
        >
          CSV
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {orders.map((o) => {
          const p = people.data?.get(o.user_id);
          return (
            <li key={o.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-[13px]">
              <Avatar name={p?.name ?? '?'} src={p?.avatarUrl} size={22} />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{name(o.user_id)}</span> <span className="text-muted">· {describe(o)}</span>
              </span>
              <Checkbox checked={o.paid} disabled={!canPaid} onChange={(v) => set(o, { paid: v })} label="Paid" />
              <Checkbox checked={o.delivered} disabled={!canManage} onChange={(v) => set(o, { delivered: v })} label="Delivered" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DriveEditor({ drive, onClose }: { drive: Drive | null; onClose: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const scope = useTeamScope();
  const field = sizeField();
  const defaultSizes = field?.type === 'select' && field.options.length ? field.options : ['YS', 'YM', 'YL', 'S', 'M', 'L', 'XL', '2XL'];
  const [v, setV] = useState({
    title: drive?.title ?? '',
    description: drive?.description ?? '',
    closes_at: drive?.closes_at ? toDateTimeInput(new Date(drive.closes_at)) : '',
    status: drive?.status ?? 'open',
    team_id: drive ? drive.team_id : scope,
  });
  const [items, setItems] = useState<{ id: string; name: string; price: string; sizes: string[] }[]>(
    drive?.items.map((i) => ({ id: i.id, name: i.name, price: i.price ?? '', sizes: i.sizes })) ?? [{ id: crypto.randomUUID().slice(0, 8), name: 'Team T-shirt', price: '', sizes: defaultSizes }],
  );
  const save = async () => {
    if (!validateRequired()) return;
    if (!v.title.trim()) return toast.error('Name the order drive');
    const clean = items.filter((i) => i.name.trim()).map((i) => ({ id: i.id, name: i.name.trim(), price: i.price.trim() || null, sizes: i.sizes }));
    if (!clean.length) return toast.error('Add at least one item');
    const body = { title: v.title.trim(), description: v.description.trim() || null, closes_at: v.closes_at ? new Date(v.closes_at).toISOString() : null, status: v.status, team_id: v.team_id, items: clean };
    const { error } = drive ? await sb.from('mer_drives').update(body).eq('id', drive.id) : await sb.from('mer_drives').insert({ ...body, created_by: me.id });
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['merch'] });
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={drive ? 'Edit order drive' : 'New order drive'}
      size="lg"
      footer={
        <>
          {drive && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (!(await confirm({ title: `Delete “${drive.title}”?`, body: 'All orders in it are deleted. Export the CSV first if you need it.', danger: true, typeToConfirm: drive.title, confirmLabel: 'Delete' }))) return;
                await sb.from('mer_drives').delete().eq('id', drive.id);
                qc.invalidateQueries({ queryKey: ['merch'] });
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
        <Field label="Title" required>{(id) => <Input id={id} autoFocus maxLength={120} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="2026–27 team shirts" />}</Field>
        <Field label="Details" optional hint="How to pay, pickup, etc.">{(id) => <Textarea id={id} rows={2} maxLength={2000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />}</Field>
        <div className="space-y-2">
          <p className="text-[13px] font-medium">Items</p>
          {items.map((i, n) => (
            <div key={i.id} className="space-y-2 rounded-md border border-border p-2.5">
              <div className="grid grid-cols-[1fr_6rem_auto] gap-2">
                <Input aria-label="Item" placeholder="Hoodie" value={i.name} onChange={(e) => setItems(items.map((x, j) => (j === n ? { ...x, name: e.target.value } : x)))} />
                <Input aria-label="Price" placeholder="$25" value={i.price} onChange={(e) => setItems(items.map((x, j) => (j === n ? { ...x, price: e.target.value } : x)))} />
                <IconButton label="Remove item" onClick={() => setItems(items.filter((_, j) => j !== n))} disabled={items.length === 1}>
                  <X className="size-4" />
                </IconButton>
              </div>
              <TagListInput label="Size" placeholder="Add a size (none = one size)" maxLength={20} value={i.sizes} onChange={(sizes) => setItems(items.map((x, j) => (j === n ? { ...x, sizes } : x)))} />
            </div>
          ))}
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setItems([...items, { id: crypto.randomUUID().slice(0, 8), name: '', price: '', sizes: defaultSizes }])}>
            Add item
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Orders close" optional>{(id) => <Input id={id} type="datetime-local" value={v.closes_at} onChange={(e) => setV({ ...v, closes_at: e.target.value })} />}</Field>
          {drive && (
            <Field label="Status">
              {(id) => (
                <Select id={id} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as Drive['status'] })}>
                  <option value="open">Taking orders</option>
                  <option value="closed">Closed</option>
                  <option value="delivered">Delivered</option>
                </Select>
              )}
            </Field>
          )}
        </div>
        <TeamScopePicker value={v.team_id} onChange={(t) => setV({ ...v, team_id: t })} perm="merch.manage" />
        <ScopeVisibility teamId={v.team_id} suffix="(the drive: each person's order is visible only to them and managers)" />
      </div>
    </Dialog>
  );
}
