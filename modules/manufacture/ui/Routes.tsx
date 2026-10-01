import { lazy, Suspense, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Box, Check, Eye, Pause, Play, Printer, Trash2, X } from 'lucide-react';
import {
  AvatarStack,
  Badge,
  Banner,
  Button,
  Dialog,
  DueDate,
  EmptyState,
  ErrorState,
  Field,
  FileCard,
  Input,
  Kanban,
  KanbanCard,
  Markdown,
  Segmented,
  Select,
  Sheet,
  Spinner,
  StatusPill,
  Switch,
  Textarea,
  Toolbar,
  gunzipBlob,
  formatBytes,
  toast,
  useConfirm,
  type ProcessedFile,
} from '@teamhub/ui';
import {
  canWith,
  CommentThread,
  downloadFile,
  friendlyError,
  ModuleHeader,
  ModuleNewMenu,
  ModulePurpose,
  Person,
  ScopeVisibility,
  Slot,
  storagePath,
  TeamBadge,
  TeamScopePicker,
  Upload,
  uploadFile,
  useCan,
  useCreateShortcut,
  useMe,
  useModuleSettings,
  useNewParam,
  usePeople,
  usePositionHolders,
  useRows,
  useSelectedParam,
  useSupabase,
  useTeamScope,
} from '@teamhub/sdk';

const ModelViewer = lazy(() => import('./ModelViewer'));

export type JobStatus = 'submitted' | 'queued' | 'in_progress' | 'done' | 'failed' | 'cancelled';
export interface Job {
  id: string;
  team_id: string | null;
  title: string;
  method: string;
  qty: number;
  material: string | null;
  color: string | null;
  priority: number;
  needed_by: string | null;
  status: JobStatus;
  params: string | null;
  notes: string | null;
  onshape_url: string | null;
  keep_files: boolean;
  requested_by: string | null;
  assigned_to: string | null;
  created_at: string;
  done_at: string | null;
}
interface MfgFile {
  id: string;
  job_id: string;
  path: string;
  name: string;
  size_bytes: number;
  compressed: boolean;
}
export interface Method {
  id: string;
  name: string;
  positions: string[];
}
interface Settings {
  methods: Method[];
  autoDeleteDays: number;
  maxFileMB: number;
}

export const STATUS: Record<JobStatus, { label: string; tone: 'neutral' | 'info' | 'accent' | 'success' | 'danger' | 'warning' }> = {
  submitted: { label: 'Submitted', tone: 'neutral' },
  queued: { label: 'Queued', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'accent' },
  done: { label: 'Done', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'warning' },
};

export const useJobs = () => useRows<Job>(['manufacture', 'jobs'], (sb) => sb.from('mfg_jobs').select('*').order('priority', { ascending: false }).order('created_at'));
const useFiles = () => useRows<MfgFile>(['manufacture', 'files'], (sb) => sb.from('mfg_files').select('*'));
export const useMfgSettings = () => useModuleSettings<Settings>('manufacture');

export function canManage(me: ReturnType<typeof useMe>, j: Pick<Job, 'method' | 'team_id'>) {
  return canWith(me, `manufacture.manage_${j.method}`, j.team_id) || canWith(me, 'manufacture.delete_any', j.team_id);
}

export default function ManufactureRoutes() {
  const jobs = useJobs();
  const files = useFiles();
  const settings = useMfgSettings();
  const me = useMe();
  const scope = useTeamScope();
  const canSubmit = useCan('manufacture.submit');
  const [method, setMethod] = useState('all');
  const [mine, setMine] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [creating, setCreating, params] = useNewParam();
  const [selected, setSelected] = useSelectedParam();
  useCreateShortcut(() => setCreating(true), canSubmit);
  const fileCount = new Map<string, number>();
  for (const f of files.data ?? []) fileCount.set(f.job_id, (fileCount.get(f.job_id) ?? 0) + 1);

  const list = (jobs.data ?? []).filter((j) => (!scope || !j.team_id || j.team_id === scope) && (method === 'all' || j.method === method) && (!mine || j.requested_by === me.id || j.assigned_to === me.id));
  const current = (jobs.data ?? []).find((j) => j.id === selected) ?? null;
  const methodName = (id: string) => settings.methods.find((m) => m.id === id)?.name ?? id;
  const cols: JobStatus[] = showClosed ? ['failed', 'cancelled'] : ['submitted', 'queued', 'in_progress', 'done'];
  const sb = useSupabase();
  const qc = useQueryClient();

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader moduleId="manufacture" actions={canSubmit && <ModuleNewMenu moduleId="manufacture" label="Submit a part" onNew={() => setCreating(true)} />} />
      <Toolbar>
        <Segmented size="sm" value={method} onChange={setMethod} options={[{ value: 'all', label: 'All methods' }, ...settings.methods.map((m) => ({ value: m.id, label: m.name }))]} />
        <span className="flex-1" />
        <Switch checked={mine} onChange={setMine} label={<span className="text-[12.5px] font-normal">Only mine</span>} />
        <Switch checked={showClosed} onChange={setShowClosed} label={<span className="text-[12.5px] font-normal">Failed & cancelled</span>} />
      </Toolbar>
      <div className="min-h-0 flex-1">
        {jobs.isLoading ? (
          <Spinner className="m-8" />
        ) : jobs.error ? (
          <ErrorState error={jobs.error} retry={() => jobs.refetch()} />
        ) : !list.length && !showClosed ? (
          <EmptyState icon={<Printer />} title="No parts in the queue" body={<ModulePurpose moduleId="manufacture" compact className="mt-2 text-left" />} action={canSubmit && <Button onClick={() => setCreating(true)}>Submit a part</Button>} />
        ) : (
          <Kanban
            columns={cols.map((s) => ({ id: s, title: STATUS[s].label, items: list.filter((j) => j.status === s) }))}
            keyOf={(j) => j.id}
            canDrag={(j) => canManage(me, j)}
            onMove={async (j, to) => {
              if (to === j.status) return;
              const { error } = await sb.from('mfg_jobs').update({ status: to }).eq('id', j.id);
              if (error) toast.error(friendlyError(error));
              qc.invalidateQueries({ queryKey: ['manufacture'] });
            }}
            render={(j) => (
              <KanbanCard onClick={() => setSelected(j.id)}>
                <p className="font-medium leading-snug">{j.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                  <Badge>{methodName(j.method)}</Badge>
                  {j.qty > 1 && <Badge>×{j.qty}</Badge>}
                  {j.priority >= 2 && <Badge tone={j.priority === 3 ? 'danger' : 'warning'}>{j.priority === 3 ? 'Urgent' : 'High'}</Badge>}
                  <DueDate date={j.needed_by} done={j.status === 'done'} />
                  {fileCount.get(j.id) ? (
                    <span className="inline-flex items-center gap-0.5 text-muted">
                      <Box className="size-3" /> {fileCount.get(j.id)}
                    </span>
                  ) : null}
                  <span className="flex-1" />
                  <RequesterAvatar id={j.requested_by} />
                </div>
              </KanbanCard>
            )}
          />
        )}
      </div>
      {creating && <SubmitDialog onClose={() => setCreating(false)} draftTitle={params.get('title') ?? ''} />}
      {current && <JobSheet job={current} files={(files.data ?? []).filter((f) => f.job_id === current.id)} onClose={() => setSelected(null)} />}
    </div>
  );
}

function RequesterAvatar({ id }: { id: string | null }) {
  const people = usePeople();
  const p = id ? people.data?.get(id) : null;
  return p ? <AvatarStack people={[{ name: p.name, src: p.avatarUrl }]} size={20} /> : null;
}

function SubmitDialog({ onClose, draftTitle }: { onClose: () => void; draftTitle: string }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const scope = useTeamScope();
  const settings = useMfgSettings();
  const [v, setV] = useState({ title: draftTitle, method: settings.methods[0]?.id ?? '', qty: 1, material: '', color: '', priority: 1, needed_by: '', params: '', notes: '', onshape_url: '', team_id: scope });
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const method = settings.methods.find((m) => m.id === v.method);
  const holders = usePositionHolders(method?.positions ?? []);
  const submit = async () => {
    if (!v.title.trim()) return toast.error('Name the part');
    if (!files.length && !v.onshape_url) return toast.error('Attach a file or paste an Onshape link');
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const { error } = await sb.from('mfg_jobs').insert({
        id,
        title: v.title.trim(),
        method: v.method,
        qty: v.qty,
        material: v.material || null,
        color: v.color || null,
        priority: v.priority,
        needed_by: v.needed_by || null,
        params: v.params || null,
        notes: v.notes || null,
        onshape_url: v.onshape_url || null,
        team_id: v.team_id,
        requested_by: me.id,
      });
      if (error) throw error;
      for (const f of files) {
        const path = await uploadFile('manufacture', storagePath(v.team_id, id, f.name), f);
        const res = await sb.from('mfg_files').insert({ job_id: id, path, name: f.name, size_bytes: f.size, compressed: f.compressed });
        if (res.error) throw res.error;
      }
      qc.invalidateQueries({ queryKey: ['manufacture'] });
      toast.success('Part submitted — the right people were notified');
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
      onOpenChange={(x) => !x && onClose()}
      title="Submit a part to make"
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Submit
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ModulePurpose moduleId="manufacture" compact />
        <TeamScopePicker value={v.team_id} onChange={(team_id) => setV({ ...v, team_id })} perm="manufacture.submit" />
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <Field label="Part name">{(id) => <Input id={id} autoFocus maxLength={140} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />}</Field>
          <Field label="Method">
            {(id) => (
              <Select id={id} value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })}>
                {settings.methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {method && (
          <p className="text-[12.5px] text-muted">
            {holders.length ? (
              <>Goes to: {holders.map((h) => h.name).join(', ')}</>
            ) : (
              <span className="inline-flex items-center gap-1 text-warning">
                <AlertTriangle className="size-3.5" /> Nobody holds the position for {method.name} yet — mentors will get this job.
              </span>
            )}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Quantity">{(id) => <Input id={id} type="number" min={1} max={999} value={v.qty} onChange={(e) => setV({ ...v, qty: Number(e.target.value) || 1 })} />}</Field>
          <Field label="Material" optional>{(id) => <Input id={id} placeholder="PLA, PETG…" value={v.material} onChange={(e) => setV({ ...v, material: e.target.value })} />}</Field>
          <Field label="Color" optional>{(id) => <Input id={id} value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} />}</Field>
          <Field label="Needed by" optional>{(id) => <Input id={id} type="date" value={v.needed_by} onChange={(e) => setV({ ...v, needed_by: e.target.value })} />}</Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Settings" optional hint="Infill, layer height, supports…">{(id) => <Input id={id} maxLength={500} value={v.params} onChange={(e) => setV({ ...v, params: e.target.value })} />}</Field>
          <Field label="Priority">
            {(id) => (
              <Select id={id} value={v.priority} onChange={(e) => setV({ ...v, priority: Number(e.target.value) })}>
                <option value={0}>Low</option>
                <option value={1}>Normal</option>
                <option value={2}>High</option>
                <option value={3}>Urgent</option>
              </Select>
            )}
          </Field>
        </div>
        <Field label="Notes" optional>{(id) => <Textarea id={id} rows={2} maxLength={2000} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />}</Field>
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium">Files</p>
          {files.map((f) => (
            <FileCard key={f.name} name={f.originalName} size={f.size} compressed={f.compressed} onDelete={() => setFiles(files.filter((x) => x !== f))} />
          ))}
          {files.length < 5 && (
            <Upload
              kind="model"
              maxFiles={5 - files.length}
              maxBytes={(settings.maxFileMB ?? 25) * 1024 * 1024}
              onFiles={(f) => setFiles([...files, ...f].slice(0, 5))}
              onLink={(url) => setV({ ...v, onshape_url: url })}
              label="Drop STL, 3MF, STEP, DXF or PDF files or"
            />
          )}
          {v.onshape_url && (
            <p className="text-[12.5px] text-muted">
              Link: {v.onshape_url}{' '}
              <button className="text-accent" onClick={() => setV({ ...v, onshape_url: '' })}>
                remove
              </button>
            </p>
          )}
          <p className="text-[12px] text-faint">Model files are compressed and deleted {settings.autoDeleteDays} days after the part is done (unless the maker keeps them).</p>
        </div>
        <ScopeVisibility teamId={v.team_id} />
      </div>
    </Dialog>
  );
}

function JobSheet({ job: j, files, onClose }: { job: Job; files: MfgFile[]; onClose: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const settings = useMfgSettings();
  const [preview, setPreview] = useState<{ name: string; data: ArrayBuffer } | null>(null);
  const manager = canManage(me, j);
  const own = j.requested_by === me.id && j.status === 'submitted';
  const refresh = () => qc.invalidateQueries({ queryKey: ['manufacture'] });
  const update = async (patch: Partial<Job>) => {
    const { error } = await sb.from('mfg_jobs').update(patch).eq('id', j.id);
    if (error) toast.error(friendlyError(error));
    refresh();
  };
  const st = STATUS[j.status];
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={j.title} width="w-[min(100vw,600px)]">
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={st.label} tone={st.tone} />
          <Badge>{settings.methods.find((m) => m.id === j.method)?.name ?? j.method}</Badge>
          <Badge>×{j.qty}</Badge>
          <DueDate date={j.needed_by} done={j.status === 'done'} />
          <TeamBadge teamId={j.team_id} />
        </div>
        {manager && (
          <div className="flex flex-wrap gap-2">
            {j.status === 'submitted' && (
              <Button size="sm" icon={<Pause className="size-4" />} onClick={() => update({ status: 'queued' })}>
                Queue it
              </Button>
            )}
            {['submitted', 'queued'].includes(j.status) && (
              <Button size="sm" variant="primary" icon={<Play className="size-4" />} onClick={() => update({ status: 'in_progress', assigned_to: j.assigned_to ?? me.id })}>
                Start
              </Button>
            )}
            {j.status === 'in_progress' && (
              <>
                <Button size="sm" variant="primary" icon={<Check className="size-4" />} onClick={() => update({ status: 'done' })}>
                  Done
                </Button>
                <Button size="sm" icon={<X className="size-4" />} onClick={() => update({ status: 'failed' })}>
                  Failed
                </Button>
              </>
            )}
            {['done', 'failed', 'cancelled'].includes(j.status) && (
              <Button size="sm" onClick={() => update({ status: 'queued' })}>
                Re-queue
              </Button>
            )}
          </div>
        )}
        {own && (
          <Button size="sm" onClick={() => update({ status: 'cancelled' })}>
            Cancel my request
          </Button>
        )}
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-[13px]">
          <dt className="text-muted">Requested by</dt>
          <dd>
            <Person id={j.requested_by} size="sm" />
          </dd>
          <dt className="text-muted">Maker</dt>
          <dd>{j.assigned_to ? <Person id={j.assigned_to} size="sm" /> : <span className="text-faint">Not started</span>}</dd>
          {(j.material || j.color) && (
            <>
              <dt className="text-muted">Material</dt>
              <dd>{[j.material, j.color].filter(Boolean).join(' · ')}</dd>
            </>
          )}
          {j.params && (
            <>
              <dt className="text-muted">Settings</dt>
              <dd>{j.params}</dd>
            </>
          )}
          {j.onshape_url && (
            <>
              <dt className="text-muted">CAD</dt>
              <dd>
                <a className="text-accent hover:underline" href={j.onshape_url} target="_blank" rel="noreferrer">
                  Open link ↗
                </a>
              </dd>
            </>
          )}
        </dl>
        {j.notes && <Markdown source={j.notes} className="rounded-md bg-bg-subtle p-3 text-[13px]" />}
        <section className="space-y-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-faint">Files</h3>
          {files.map((f) => {
            const previewable = /\.(stl|obj|3mf)(\.gz)?$/i.test(f.name);
            return (
              <div key={f.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <FileCard
                    name={f.name.replace(/\.gz$/, '')}
                    size={f.size_bytes}
                    compressed={f.compressed}
                    onDownload={() => downloadFile('manufacture', f.path, f.name).catch((e) => toast.error(friendlyError(e)))}
                    onDelete={
                      manager || own
                        ? async () => {
                            if (!(await confirm({ title: `Delete ${f.name.replace(/\.gz$/, '')}?`, danger: true, confirmLabel: 'Delete' }))) return;
                            const { error } = await sb.from('mfg_files').delete().eq('id', f.id);
                            if (error) return toast.error(friendlyError(error));
                            await sb.storage.from('manufacture').remove([f.path]);
                            refresh();
                          }
                        : undefined
                    }
                  />
                </div>
                {previewable && (
                  <Button
                    size="sm"
                    icon={<Eye className="size-4" />}
                    onClick={async () => {
                      const { data, error } = await sb.storage.from('manufacture').download(f.path);
                      if (error || !data) return toast.error(friendlyError(error));
                      const blob = f.name.endsWith('.gz') ? await gunzipBlob(data) : data;
                      setPreview({ name: f.name, data: await blob.arrayBuffer() });
                    }}
                  >
                    3D
                  </Button>
                )}
              </div>
            );
          })}
          {!files.length && <p className="text-[12.5px] text-faint">{j.status === 'done' ? 'Files were cleaned up after the part was made.' : 'No files attached.'}</p>}
          {manager && <Switch checked={j.keep_files} onChange={(keep_files) => update({ keep_files })} label="Keep files after it's done" description={`Otherwise deleted ${settings.autoDeleteDays} days after completion to save storage.`} />}
          {files.length > 0 && <p className="text-[11.5px] text-faint">Total {formatBytes(files.reduce((s, f) => s + f.size_bytes, 0))}</p>}
        </section>
        {preview && (
          <Suspense fallback={<Spinner />}>
            <ModelViewer data={preview.data} name={preview.name} />
          </Suspense>
        )}
        <Slot name="manufacture.job.actions" props={{ job: j }} wrap={(c) => <div className="flex flex-wrap gap-2">{c}</div>} />
        {(manager || own) && (
          <Button
            variant="ghost"
            className="text-danger"
            icon={<Trash2 className="size-4" />}
            onClick={async () => {
              if (!(await confirm({ title: 'Delete this job and its files?', danger: true, confirmLabel: 'Delete' }))) return;
              const paths = files.map((f) => f.path);
              const { error } = await sb.from('mfg_jobs').delete().eq('id', j.id);
              if (error) return toast.error(friendlyError(error));
              if (paths.length) await sb.storage.from('manufacture').remove(paths);
              refresh();
              onClose();
            }}
          >
            Delete job
          </Button>
        )}
        {j.status === 'failed' && <Banner tone="warning">This attempt failed. The maker can re-queue it, or you can update the files.</Banner>}
        <CommentThread refStr={`manufacture:job:${j.id}`} />
      </div>
    </Sheet>
  );
}
