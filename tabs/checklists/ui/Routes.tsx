import { useState } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, ExternalLink, ListChecks, Pencil, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  ProgressRing,
  RelativeTime,
  Select,
  Spinner,
  cn,
  toast,
  useConfirm,
  safeHref,
} from '@teamhub/ui';
import {
  canWith,
  friendlyError,
  ModuleHeader,
  ModulePurpose,
  PersonName,
  ScopeVisibility,
  TeamScopePicker,
  useCan,
  useCreateShortcut,
  useMe,
  useNewParam,
  useRealtime,
  useRows,
  useSupabase,
  useTeamScope,
  isUrl,
} from '@teamhub/sdk';

type Kind = 'robot' | 'pit' | 'packing' | 'inspection' | 'judging' | 'portfolio' | 'other';
export interface Item {
  id: string;
  text: string;
  section?: string;
  link?: string;
}
export interface List {
  id: string;
  team_id: string | null;
  name: string;
  kind: Kind;
  items: Item[];
  sort: number;
}
export interface Run {
  id: string;
  list_id: string;
  label: string | null;
  checked: string[];
  started_by: string | null;
  started_at: string;
  completed_at: string | null;
}

export const KIND_LABEL: Record<Kind, string> = {
  robot: 'Robot (pre-match)',
  pit: 'Pit setup',
  packing: 'Packing',
  inspection: 'Inspection prep',
  judging: 'Judging & pit display',
  portfolio: 'Portfolio',
  other: 'Other',
};

const iid = () => Math.random().toString(36).slice(2, 9);
const items = (section: string, texts: string[]): Item[] => texts.map((text) => ({ id: iid(), text, section }));

/** Generic, season-agnostic starter templates (editable). */
const TEMPLATES: { name: string; kind: Kind; items: Item[] }[] = [
  {
    name: 'Pre-match robot check',
    kind: 'robot',
    items: [
      ...items('Power', ['Battery charged (check voltage)', 'Battery strapped down', 'Main power switch off for queue']),
      ...items('Mechanical', ['Wheels and drivetrain spin freely', 'All screws tight on mechanisms', 'Nothing loose or dragging']),
      ...items('Electronics', ['Control/Expansion Hub lights normal', 'Wires secured, no exposed metal', 'Driver Station charged and paired']),
      ...items('Software', ['Correct autonomous selected', 'Gamepads assigned']),
    ],
  },
  {
    name: 'Pit setup',
    kind: 'pit',
    items: items('', ['Table and power strip set up', 'Tools laid out', 'Spare parts box open', 'Team banner / display up', 'Safety glasses at the pit', 'Battery charging station running']),
  },
  {
    name: 'Packing list',
    kind: 'packing',
    items: items('', ['Robot', 'All batteries + chargers', 'Driver Station phone + controllers', 'Tool box', 'Spare parts', 'Extension cords', 'Safety glasses', 'Engineering portfolio copies', 'Team shirts', 'Consent forms']),
  },
  {
    name: 'Inspection prep',
    kind: 'inspection',
    items: items('', ['Robot fits in the sizing box', 'Team number displayed correctly', 'Approved battery and main switch accessible', 'No sharp edges', 'Wiring meets the current manual', 'Driver Station software up to date']),
  },
  {
    name: 'Judging & pit display',
    kind: 'judging',
    items: items('', ['Portfolio printed', 'Robot ready to demo', 'Talking points reviewed', 'Everyone knows their part', 'Pit display tidy']),
  },
];

const useLists = () => useRows<List>(['checklists', 'lists'], (sb) => sb.from('chk_lists').select('*').order('sort').order('name'));
const useRuns = (listId?: string) =>
  useRows<Run>(['checklists', 'runs', listId], (sb) => {
    const q = sb.from('chk_runs').select('*').order('started_at', { ascending: false }).limit(listId ? 20 : 200);
    return listId ? q.eq('list_id', listId) : q;
  });

export default function ChecklistsRoutes() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path=":id" element={<ListPage />} />
    </Routes>
  );
}

function Overview() {
  const lists = useLists();
  const runs = useRuns();
  const scope = useTeamScope();
  const canManage = useCan('checklists.manage_lists');
  const [creating, setCreating] = useNewParam();
  const nav = useNavigate();
  useCreateShortcut(() => setCreating(true), canManage);
  const shown = (lists.data ?? []).filter((l) => !scope || !l.team_id || l.team_id === scope);
  const kinds = (Object.keys(KIND_LABEL) as Kind[]).filter((k) => shown.some((l) => l.kind === k));
  return (
    <div>
      <ModuleHeader moduleId="checklists" actions={canManage && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New checklist</Button>} />
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-5 sm:px-6">
        {lists.isLoading ? (
          <Spinner />
        ) : !shown.length ? (
          <EmptyState
            icon={<ListChecks />}
            title="No checklists yet"
            body={<ModulePurpose moduleId="checklists" compact className="mt-2 text-left" />}
            action={canManage && <Button onClick={() => setCreating(true)}>Create one or start from a template</Button>}
          />
        ) : (
          kinds.map((k) => (
            <section key={k}>
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">{KIND_LABEL[k]}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {shown
                  .filter((l) => l.kind === k)
                  .map((l) => {
                    const last = (runs.data ?? []).find((r) => r.list_id === l.id);
                    return (
                      <button key={l.id} type="button" onClick={() => nav(`/checklists/${l.id}`)} className="text-left">
                        <Card className="flex items-center gap-3 p-4 transition-shadow hover:shadow-md">
                          <ProgressRing value={last ? last.checked.length / Math.max(1, l.items.length) : 0} size={44} stroke={5}>
                            <span className="text-[10px]">{last ? `${last.checked.length}/${l.items.length}` : l.items.length}</span>
                          </ProgressRing>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{l.name}</span>
                            <span className="block text-[12px] text-muted">{last ? <>Last run <RelativeTime date={last.started_at} /></> : `${l.items.length} items`}</span>
                          </span>
                        </Card>
                      </button>
                    );
                  })}
              </div>
            </section>
          ))
        )}
      </div>
      {creating && <ListEditor onClose={() => setCreating(false)} />}
    </div>
  );
}

function ListPage() {
  const { id } = useParams();
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const confirm = useConfirm();
  const lists = useLists();
  const runs = useRuns(id);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState('');
  useRealtime('chk_runs', `list_id=eq.${id}`, () => qc.invalidateQueries({ queryKey: ['checklists', 'runs'] }));
  const list = (lists.data ?? []).find((l) => l.id === id);
  if (lists.isLoading) return <Spinner className="m-8" />;
  if (!list) return <EmptyState title="Checklist not found" action={<Button onClick={() => nav('/checklists')}>Back</Button>} />;
  const run = (runs.data ?? [])[0];
  const active = run && !run.completed_at ? run : null;
  const canRun = canWith(me, 'checklists.run', list.team_id);
  const canManage = canWith(me, 'checklists.manage_lists', list.team_id);
  const start = async () => {
    const { error } = await sb.from('chk_runs').insert({ list_id: list.id, label: label.trim() || null, started_by: me.id });
    if (error) return toast.error(friendlyError(error));
    setLabel('');
    qc.invalidateQueries({ queryKey: ['checklists'] });
  };
  const toggle = async (item: string, on: boolean) => {
    if (!active) return;
    qc.setQueryData<Run[]>(['checklists', 'runs', id], (old) => old?.map((r) => (r.id === active.id ? { ...r, checked: on ? [...r.checked, item] : r.checked.filter((x) => x !== item) } : r)));
    const { error } = await sb.rpc('chk_toggle', { p_run: active.id, p_item: item, p_on: on });
    if (error) toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['checklists', 'runs'] });
  };
  const sections = [...new Set(list.items.map((i) => i.section ?? ''))];
  const shownRun = active ?? run;
  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6">
      <button type="button" onClick={() => nav('/checklists')} className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Checklists
      </button>
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-tight">{list.name}</h1>
          <p className="text-[13px] text-muted">{KIND_LABEL[list.kind]}</p>
        </div>
        {canManage && (
          <IconButton label="Edit checklist" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </IconButton>
        )}
      </div>
      {canRun && !active && (
        <Card className="mb-4 flex flex-wrap items-end gap-2 p-3">
          <Field label="Label" optional className="min-w-40 flex-1">
            {(fid) => <Input id={fid} value={label} onChange={(e) => setLabel(e.target.value)} placeholder='e.g. "Qual 12"' maxLength={60} />}
          </Field>
          <Button variant="primary" size="lg" icon={<Play className="size-4" />} onClick={start}>
            Start run
          </Button>
        </Card>
      )}
      {shownRun && (
        <div className="mb-3 flex items-center gap-3">
          <ProgressRing value={shownRun.checked.length / Math.max(1, list.items.length)} size={48}>
            {Math.round((shownRun.checked.length / Math.max(1, list.items.length)) * 100)}%
          </ProgressRing>
          <div className="min-w-0 flex-1 text-[13px]">
            <p className="font-medium">
              {shownRun.label ?? 'Run'} {shownRun.completed_at && <Badge tone="success">Complete</Badge>}
            </p>
            <p className="text-muted">
              Started by <PersonName id={shownRun.started_by} /> <RelativeTime date={shownRun.started_at} />
            </p>
          </div>
          {active && canRun && (
            <Button
              size="sm"
              icon={<RotateCcw className="size-4" />}
              onClick={async () => {
                const { error } = await sb.from('chk_runs').update({ completed_at: new Date().toISOString() }).eq('id', active.id);
                if (error) toast.error(friendlyError(error));
                qc.invalidateQueries({ queryKey: ['checklists'] });
              }}
            >
              Finish / reset
            </Button>
          )}
        </div>
      )}
      <div className="space-y-4">
        {sections.map((s) => (
          <section key={s || '_'}>
            {s && <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-faint">{s}</h3>}
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
              {list.items
                .filter((i) => (i.section ?? '') === s)
                .map((i) => {
                  const on = !!shownRun?.checked.includes(i.id);
                  return (
                    <li key={i.id} className={cn('flex min-h-14 items-center gap-3 px-4 py-2', on && 'bg-success-soft/40')}>
                      <Checkbox size="lg" checked={on} disabled={!active || !canRun} onChange={(v) => toggle(i.id, v)} label={<span className={cn('text-[15px]', on && 'text-muted line-through')}>{i.text}</span>} />
                      {isUrl(i.link) && (
                        <a href={safeHref(i.link)} target="_blank" rel="noreferrer" className="ml-auto text-accent" aria-label="Open link">
                          <ExternalLink className="size-4" />
                        </a>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
      {!active && run && <p className="mt-3 text-[12.5px] text-muted">Showing the last run. Start a new run to tick items again.</p>}
      {(runs.data?.length ?? 0) > 1 && (
        <details className="mt-6 text-[13px]">
          <summary className="cursor-pointer text-muted">Run history</summary>
          <ul className="mt-2 space-y-1">
            {runs.data!.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                {r.completed_at ? <CheckCircle2 className="size-4 text-success" /> : <span className="size-4" />}
                <span className="flex-1">{r.label ?? 'Run'}</span>
                <span className="tabular text-muted">
                  {r.checked.length}/{list.items.length}
                </span>
                <RelativeTime date={r.started_at} className="text-faint" />
              </li>
            ))}
          </ul>
        </details>
      )}
      {editing && (
        <ListEditor
          list={list}
          onClose={() => setEditing(false)}
          onDelete={async () => {
            if (!(await confirm({ title: `Delete “${list.name}”?`, body: 'Its run history is deleted too.', danger: true, confirmLabel: 'Delete' }))) return;
            const { error } = await sb.from('chk_lists').delete().eq('id', list.id);
            if (error) return toast.error(friendlyError(error));
            qc.invalidateQueries({ queryKey: ['checklists'] });
            nav('/checklists');
          }}
        />
      )}
    </div>
  );
}

function ListEditor({ list, onClose, onDelete }: { list?: List; onClose: () => void; onDelete?: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const scope = useTeamScope();
  const [name, setName] = useState(list?.name ?? '');
  const [kind, setKind] = useState<Kind>(list?.kind ?? 'robot');
  const [teamId, setTeamId] = useState<string | null>(list ? list.team_id : scope);
  const [its, setIts] = useState<Item[]>(list?.items ?? []);
  const [busy, setBusy] = useState(false);
  const move = (i: number, d: -1 | 1) => {
    const n = [...its];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    setIts(n);
  };
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={list ? 'Edit checklist' : 'New checklist'}
      size="lg"
      footer={
        <>
          {onDelete && (
            <Button variant="ghost" className="mr-auto text-danger" icon={<Trash2 className="size-4" />} onClick={onDelete}>
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              if (!name.trim()) return toast.error('Name the checklist');
              setBusy(true);
              const row = { name: name.trim(), kind, team_id: teamId, items: its.filter((i) => i.text.trim()) };
              const res = list ? await sb.from('chk_lists').update(row).eq('id', list.id) : await sb.from('chk_lists').insert({ ...row, created_by: me.id });
              setBusy(false);
              if (res.error) return toast.error(friendlyError(res.error));
              qc.invalidateQueries({ queryKey: ['checklists'] });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!list && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12.5px] text-muted">Start from a template:</span>
            {TEMPLATES.map((t) => (
              <Button
                key={t.name}
                size="sm"
                variant="ghost"
                onClick={() => {
                  setName(t.name);
                  setKind(t.kind);
                  setIts(t.items.map((i) => ({ ...i, id: iid() })));
                }}
              >
                {t.name}
              </Button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
          <Field label="Name" required>{(id) => <Input id={id} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Kind">
            {(id) => (
              <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {Object.entries(KIND_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <TeamScopePicker value={teamId} onChange={setTeamId} perm="checklists.manage_lists" />
        <div className="space-y-2">
          <p className="text-[13px] font-medium">Items</p>
          {its.map((it, i) => (
            <div key={it.id} className="flex flex-wrap items-center gap-2">
              <Input className="min-w-48 flex-1" value={it.text} placeholder="Step" onChange={(e) => setIts(its.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} aria-label="Item text" />
              <Input className="w-32" value={it.section ?? ''} placeholder="Section" onChange={(e) => setIts(its.map((x, j) => (j === i ? { ...x, section: e.target.value || undefined } : x)))} aria-label="Section" />
              <Input className="w-44" type="url" value={it.link ?? ''} placeholder="Link (optional)" onChange={(e) => setIts(its.map((x, j) => (j === i ? { ...x, link: e.target.value || undefined } : x)))} aria-label="Link" />
              <IconButton label="Move up" size="sm" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp className="size-4" />
              </IconButton>
              <IconButton label="Move down" size="sm" disabled={i === its.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown className="size-4" />
              </IconButton>
              <IconButton label="Remove item" size="sm" onClick={() => setIts(its.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          ))}
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setIts([...its, { id: iid(), text: '', section: its.at(-1)?.section }])}>
            Add item
          </Button>
        </div>
        <ScopeVisibility teamId={teamId} />
      </div>
    </Dialog>
  );
}
