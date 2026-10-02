import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Boxes, Download, ExternalLink, Minus, Pencil, Plus, ShoppingCart, Upload as UploadIcon } from 'lucide-react';
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  SearchInput,
  Select,
  Spinner,
  Switch,
  Textarea,
  Toolbar,
  downloadText,
  matches,
  parseCsv,
  toCsv,
  toast,
  useConfirm,
} from '@teamhub/ui';
import { canWith, friendlyError, isModuleEnabled, ModuleHeader, ModulePurpose, TeamScopePicker, useCan, useMe, useModuleSettings, useRows, useSupabase, useTeamScope } from '@teamhub/sdk';

export interface Part {
  id: string;
  team_id: string | null;
  name: string;
  sku: string | null;
  vendor: string | null;
  url: string | null;
  location: string | null;
  qty: number;
  low_at: number | null;
  category: string | null;
  notes: string | null;
}
export const useParts = () => useRows<Part>(['inventory', 'items'], (sb) => sb.from('inv_items').select('*').order('name'));
export const isLow = (p: Part) => p.low_at != null && p.qty <= p.low_at;
const BATTERY = /batter/i;

export default function InventoryRoutes() {
  const parts = useParts();
  const settings = useModuleSettings<{ perTeam: boolean; categories: string[] }>('inventory');
  const scope = useTeamScope();
  const me = useMe();
  const sb = useSupabase();
  const qc = useQueryClient();
  const nav = useNavigate();
  const canManage = useCan('inventory.manage');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [low, setLow] = useState(false);
  const [editing, setEditing] = useState<Part | 'new' | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const hideBatteries = isModuleEnabled('batteries');
  const list = (parts.data ?? []).filter(
    (p) =>
      (!scope || !p.team_id || p.team_id === scope) &&
      (!hideBatteries || !BATTERY.test(p.category ?? '')) &&
      (!cat || p.category === cat) &&
      (!low || isLow(p)) &&
      (!q || matches(`${p.name} ${p.sku ?? ''} ${p.location ?? ''} ${p.vendor ?? ''}`, q)),
  );
  const adjust = async (p: Part, d: number) => {
    qc.setQueryData<Part[]>(['inventory', 'items'], (old) => old?.map((x) => (x.id === p.id ? { ...x, qty: Math.max(0, x.qty + d) } : x)));
    const { error } = await sb.rpc('inv_adjust', { p_item: p.id, p_delta: d });
    if (error) toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['inventory'] });
  };
  const requestMore = (p: Part) => nav(`/purchases?new=1&item=${encodeURIComponent(p.name + (p.sku ? ` (${p.sku})` : ''))}&url=${encodeURIComponent(p.url ?? '')}&qty=${Math.max(1, (p.low_at ?? 0) * 2 - p.qty)}`);
  const cats = [...new Set([...(settings.categories ?? []), ...(parts.data ?? []).map((p) => p.category).filter(Boolean) as string[]])].filter((c) => !hideBatteries || !BATTERY.test(c));

  return (
    <div>
      <ModuleHeader
        moduleId="inventory"
        actions={
          <>
            <Button size="sm" variant="ghost" icon={<Download className="size-4" />} onClick={() => downloadText(toCsv([['name', 'sku', 'vendor', 'url', 'location', 'qty', 'low_at', 'category', 'notes'], ...list.map((p) => [p.name, p.sku, p.vendor, p.url, p.location, p.qty, p.low_at, p.category, p.notes])]), 'inventory.csv', 'text/csv')}>
              CSV
            </Button>
            {canManage && (
              <>
                <Button size="sm" variant="ghost" icon={<UploadIcon className="size-4" />} onClick={() => file.current?.click()}>
                  Import
                </Button>
                <input
                  ref={file}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    const rows = parseCsv(await f.text());
                    const [head, ...body] = rows;
                    const idx = (k: string) => head.findIndex((h) => h.trim().toLowerCase() === k);
                    if (idx('name') < 0) return toast.error('The CSV needs a "name" column (export one to see the format).');
                    const items = body
                      .filter((r) => r[idx('name')]?.trim())
                      .map((r) => {
                        const g = (k: string) => (idx(k) >= 0 ? r[idx(k)]?.trim() || null : null);
                        const url = g('url');
                        return { name: g('name')!, sku: g('sku'), vendor: g('vendor'), url: url && /^https?:\/\//.test(url) ? url : null, location: g('location'), qty: Math.max(0, Number(g('qty') ?? 0) || 0), low_at: g('low_at') ? Number(g('low_at')) : null, category: g('category'), notes: g('notes'), team_id: settings.perTeam ? scope : null };
                      });
                    const { error } = await sb.from('inv_items').insert(items);
                    if (error) return toast.error(friendlyError(error));
                    toast.success(`Imported ${items.length} parts`);
                    qc.invalidateQueries({ queryKey: ['inventory'] });
                  }}
                />
                <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
                  Add part
                </Button>
              </>
            )}
          </>
        }
      />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search name, SKU, bin…" className="w-64" />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-48" aria-label="Category">
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Switch checked={low} onChange={setLow} label={<span className="text-[12.5px] font-normal">Low stock only</span>} />
      </Toolbar>
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        {parts.isLoading ? (
          <Spinner />
        ) : (
          <DataTable
            rows={list}
            keyOf={(p) => p.id}
            empty={<EmptyState icon={<Boxes />} title={q || low || cat ? 'No parts match' : 'No parts yet'} body={<ModulePurpose moduleId="inventory" compact className="mt-2 text-left" />} />}
            columns={[
              {
                id: 'name',
                header: 'Part',
                sort: (p) => p.name.toLowerCase(),
                cell: (p) => (
                  <span>
                    <span className="font-medium">{p.name}</span>
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noreferrer" className="ml-1 inline-block text-faint hover:text-accent" aria-label="Vendor page">
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                    <span className="block text-[11.5px] text-faint">{[p.sku, p.vendor].filter(Boolean).join(' · ')}</span>
                  </span>
                ),
              },
              { id: 'cat', header: 'Category', sort: (p) => p.category ?? '', cell: (p) => p.category ?? '—' },
              { id: 'loc', header: 'Bin', sort: (p) => p.location ?? '', cell: (p) => p.location ?? '—' },
              {
                id: 'qty',
                header: 'Qty',
                align: 'right',
                sort: (p) => p.qty,
                cell: (p) => (
                  <span className="inline-flex items-center gap-1">
                    {canWith(me, 'inventory.edit_qty', p.team_id) && (
                      <IconButton label={`One less ${p.name}`} size="sm" className="size-7" onClick={() => adjust(p, -1)} disabled={p.qty === 0}>
                        <Minus className="size-3.5" />
                      </IconButton>
                    )}
                    <span className={`tabular w-8 text-center font-semibold ${isLow(p) ? 'text-danger' : ''}`}>{p.qty}</span>
                    {canWith(me, 'inventory.edit_qty', p.team_id) && (
                      <IconButton label={`One more ${p.name}`} size="sm" className="size-7" onClick={() => adjust(p, 1)}>
                        <Plus className="size-3.5" />
                      </IconButton>
                    )}
                  </span>
                ),
              },
              {
                id: 'act',
                header: '',
                cell: (p) => (
                  <span className="flex justify-end gap-1">
                    {isLow(p) && <Badge tone="danger">Low</Badge>}
                    {isModuleEnabled('purchases') && (isLow(p) || p.qty === 0) && (
                      <Button size="sm" variant="ghost" icon={<ShoppingCart className="size-3.5" />} onClick={() => requestMore(p)}>
                        Request more
                      </Button>
                    )}
                    {canWith(me, 'inventory.manage', p.team_id) && (
                      <IconButton label={`Edit ${p.name}`} size="sm" onClick={() => setEditing(p)}>
                        <Pencil className="size-3.5" />
                      </IconButton>
                    )}
                  </span>
                ),
              },
            ]}
          />
        )}
      </div>
      {editing && <PartDialog part={editing === 'new' ? null : editing} categories={cats} perTeam={settings.perTeam} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PartDialog({ part, categories, perTeam, onClose }: { part: Part | null; categories: string[]; perTeam: boolean; onClose: () => void }) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const scope = useTeamScope();
  const [v, setV] = useState({
    name: part?.name ?? '',
    sku: part?.sku ?? '',
    vendor: part?.vendor ?? '',
    url: part?.url ?? '',
    location: part?.location ?? '',
    qty: part?.qty ?? 0,
    low_at: part?.low_at != null ? String(part.low_at) : '',
    category: part?.category ?? '',
    notes: part?.notes ?? '',
    team_id: part ? part.team_id : perTeam ? scope : null,
  });
  return (
    <Dialog
      open
      onOpenChange={(x) => !x && onClose()}
      title={part ? `Edit ${part.name}` : 'Add a part'}
      footer={
        <>
          {part && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={async () => {
                if (!(await confirm({ title: `Delete ${part.name}?`, danger: true, confirmLabel: 'Delete' }))) return;
                const { error } = await sb.from('inv_items').delete().eq('id', part.id);
                if (error) return toast.error(friendlyError(error));
                qc.invalidateQueries({ queryKey: ['inventory'] });
                onClose();
              }}
            >
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (!v.name.trim()) return toast.error('Name the part');
              if (v.url && !/^https?:\/\//.test(v.url)) return toast.error('Links must start with https://');
              const row = { ...v, name: v.name.trim(), sku: v.sku || null, vendor: v.vendor || null, url: v.url || null, location: v.location || null, low_at: v.low_at === '' ? null : Number(v.low_at), category: v.category || null, notes: v.notes || null, updated_at: new Date().toISOString() };
              const res = part ? await sb.from('inv_items').update(row).eq('id', part.id) : await sb.from('inv_items').insert(row);
              if (res.error) return toast.error(friendlyError(res.error));
              qc.invalidateQueries({ queryKey: ['inventory'] });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">{(id) => <Input id={id} autoFocus maxLength={160} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}</Field>
        <Field label="SKU / part number" optional>{(id) => <Input id={id} value={v.sku} onChange={(e) => setV({ ...v, sku: e.target.value })} />}</Field>
        <Field label="Vendor" optional>{(id) => <Input id={id} value={v.vendor} onChange={(e) => setV({ ...v, vendor: e.target.value })} placeholder="goBILDA, REV…" />}</Field>
        <Field label="Product link" optional className="sm:col-span-2">{(id) => <Input id={id} type="url" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} />}</Field>
        <Field label="Bin / location" optional>{(id) => <Input id={id} value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} placeholder="Drawer B3" />}</Field>
        <Field label="Category" optional>
          {(id) => (
            <>
              <Input id={id} list="inv-cats" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} />
              <datalist id="inv-cats">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Quantity">{(id) => <Input id={id} type="number" min={0} value={v.qty} onChange={(e) => setV({ ...v, qty: Math.max(0, Number(e.target.value) || 0) })} />}</Field>
        <Field label="Low at" optional hint="Flag as low when this many or fewer are left">{(id) => <Input id={id} type="number" min={0} value={v.low_at} onChange={(e) => setV({ ...v, low_at: e.target.value })} />}</Field>
        <Field label="Notes" optional className="sm:col-span-2">{(id) => <Textarea id={id} rows={2} maxLength={500} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />}</Field>
        {perTeam && (
          <div className="sm:col-span-2">
            <TeamScopePicker value={v.team_id} onChange={(team_id) => setV({ ...v, team_id })} perm="inventory.manage" label="Belongs to" />
          </div>
        )}
      </div>
    </Dialog>
  );
}
