import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Check, SquarePlus, Trash2, Wrench } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  Input,
  ListRow,
  Markdown,
  RelativeTime,
  Select,
  Sheet,
  SmartGroupList,
  Spinner,
  StatusPill,
  Textarea,
  formatDateTime,
  toDateTimeInput,
  toast,
  useConfirm,
  type ProcessedFile,
} from '@teamhub/ui';
import {
  canWith,
  CommentThread,
  friendlyError,
  isModuleEnabled,
  ModuleHeader,
  ModuleNewMenu,
  ModulePurpose,
  Person,
  PersonName,
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
  useNewParam,
  useRows,
  useSelectedParam,
  useSignedUrls,
  useSupabase,
  useTeamScope,
} from '@teamhub/sdk';

export interface Issue {
  id: string;
  team_id: string | null;
  title: string;
  subsystem_text: string | null;
  severity: 1 | 2 | 3;
  status: 'open' | 'fixed' | 'wontfix';
  happened_at: string;
  event_label: string | null;
  cause: string | null;
  fix: string | null;
  reported_by: string | null;
  fixed_by: string | null;
  image_path: string | null;
  season: string;
  created_at: string;
}
const SEV = { 1: { label: 'Minor', tone: 'neutral' as const }, 2: { label: 'Major', tone: 'warning' as const }, 3: { label: 'Critical', tone: 'danger' as const } };
const useIssues = () => useRows<Issue>(['repairs', 'list'], (sb) => sb.from('rep_issues').select('*').order('happened_at', { ascending: false }));

export default function RepairsRoutes() {
  const issues = useIssues();
  const scope = useTeamScope();
  const canReport = useCan('repairs.report');
  const [creating, setCreating, params] = useNewParam();
  const [selected, setSelected] = useSelectedParam();
  useCreateShortcut(() => setCreating(true), canReport);
  const list = (issues.data ?? []).filter((i) => !scope || !i.team_id || i.team_id === scope);
  const current = list.find((i) => i.id === selected) ?? null;
  const groups = useMemo(
    () => [
      { id: 'open', title: 'Open', tone: 'warning' as const, items: list.filter((i) => i.status === 'open').sort((a, b) => b.severity - a.severity) },
      { id: 'fixed', title: 'Fixed', items: list.filter((i) => i.status === 'fixed') },
      { id: 'wontfix', title: "Won't fix", items: list.filter((i) => i.status === 'wontfix'), collapsed: true },
    ],
    [list],
  );
  return (
    <div className="flex h-full flex-col">
      <ModuleHeader moduleId="repairs" actions={canReport && <ModuleNewMenu moduleId="repairs" label="Report a breakage" onNew={() => setCreating(true)} />} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {issues.isLoading ? (
          <Spinner className="m-8" />
        ) : (
          <SmartGroupList
            groups={groups}
            keyOf={(i) => i.id}
            empty={<EmptyState icon={<Wrench />} title="Nothing broken (yet)" body={<ModulePurpose moduleId="repairs" compact className="mt-2 text-left" />} />}
            render={(i) => (
              <ListRow selected={i.id === selected} onClick={() => setSelected(i.id)}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{i.title}</p>
                  <p className="text-[12px] text-muted">
                    {[i.subsystem_text, i.event_label].filter(Boolean).join(' · ')} {i.subsystem_text || i.event_label ? '· ' : ''}
                    <RelativeTime date={i.happened_at} /> · <PersonName id={i.reported_by} />
                  </p>
                </div>
                <StatusPill label={SEV[i.severity].label} tone={SEV[i.severity].tone} />
              </ListRow>
            )}
          />
        )}
      </div>
      {creating && <IssueDialog onClose={() => setCreating(false)} draftTitle={params.get('title') ?? ''} />}
      {current && <IssueSheet issue={current} onClose={() => setSelected(null)} />}
    </div>
  );
}

function IssueDialog({ issue, onClose, draftTitle = '' }: { issue?: Issue; onClose: () => void; draftTitle?: string }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const scope = useTeamScope();
  const subs = [...new Set((qc.getQueryData<Issue[]>(['repairs', 'list']) ?? []).map((i) => i.subsystem_text).filter(Boolean) as string[])];
  const [v, setV] = useState({
    title: issue?.title ?? draftTitle,
    subsystem_text: issue?.subsystem_text ?? '',
    severity: issue?.severity ?? 2,
    happened_at: toDateTimeInput(issue ? new Date(issue.happened_at) : new Date()),
    event_label: issue?.event_label ?? '',
    cause: issue?.cause ?? '',
    fix: issue?.fix ?? '',
    team_id: issue ? issue.team_id : scope,
  });
  const [photo, setPhoto] = useState<ProcessedFile | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(x) => !x && onClose()}
      title={issue ? 'Edit issue' : 'Report a breakage or issue'}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              if (!v.title.trim()) return toast.error('What broke?');
              setBusy(true);
              try {
                const id = issue?.id ?? crypto.randomUUID();
                let image_path = issue?.image_path ?? null;
                if (photo) image_path = await uploadFile('repairs', storagePath(v.team_id, id, photo.name), photo);
                const row = { ...v, title: v.title.trim(), subsystem_text: v.subsystem_text || null, event_label: v.event_label || null, cause: v.cause || null, fix: v.fix || null, happened_at: new Date(v.happened_at).toISOString(), image_path };
                const res = issue ? await sb.from('rep_issues').update(row).eq('id', id) : await sb.from('rep_issues').insert({ ...row, id, reported_by: me.id });
                if (res.error) throw res.error;
                qc.invalidateQueries({ queryKey: ['repairs'] });
                onClose();
              } catch (e) {
                toast.error(friendlyError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!issue && <ModulePurpose moduleId="repairs" compact />}
        <TeamScopePicker value={v.team_id} onChange={(team_id) => setV({ ...v, team_id })} perm="repairs.report" label="Robot of" />
        <Field label="What broke?">{(id) => <Input id={id} autoFocus maxLength={160} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Intake belt snapped" />}</Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Subsystem" optional>
            {(id) => (
              <>
                <Input id={id} list="rep-subs" value={v.subsystem_text} onChange={(e) => setV({ ...v, subsystem_text: e.target.value })} placeholder="Intake" />
                <datalist id="rep-subs">
                  {subs.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Severity">
            {(id) => (
              <Select id={id} value={v.severity} onChange={(e) => setV({ ...v, severity: Number(e.target.value) as 1 })}>
                <option value={1}>Minor</option>
                <option value={2}>Major</option>
                <option value={3}>Critical</option>
              </Select>
            )}
          </Field>
          <Field label="When">{(id) => <Input id={id} type="datetime-local" value={v.happened_at} onChange={(e) => setV({ ...v, happened_at: e.target.value })} />}</Field>
        </div>
        <Field label="At" optional hint='e.g. "Qual 14, League Meet 2" or "Practice"'>{(id) => <Input id={id} maxLength={80} value={v.event_label} onChange={(e) => setV({ ...v, event_label: e.target.value })} />}</Field>
        <Field label="Why it happened" optional>{(id) => <Textarea id={id} rows={2} maxLength={3000} value={v.cause} onChange={(e) => setV({ ...v, cause: e.target.value })} />}</Field>
        <Field label="How it was / will be fixed" optional>{(id) => <Textarea id={id} rows={2} maxLength={3000} value={v.fix} onChange={(e) => setV({ ...v, fix: e.target.value })} />}</Field>
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium">Photo {photo && <Badge>ready</Badge>}</p>
          <Upload kind="photo" onFiles={([f]) => setPhoto(f)} />
        </div>
        <ScopeVisibility teamId={v.team_id} />
      </div>
    </Dialog>
  );
}

function IssueSheet({ issue: i, onClose }: { issue: Issue; onClose: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const confirm = useConfirm();
  const img = useSignedUrls('repairs', [i.image_path]);
  const [editing, setEditing] = useState(false);
  const canManage = canWith(me, 'repairs.manage', i.team_id) || (i.reported_by === me.id && canWith(me, 'repairs.report', i.team_id));
  const set = async (status: Issue['status']) => {
    const { error } = await sb.from('rep_issues').update({ status, fixed_by: status === 'fixed' ? me.id : null }).eq('id', i.id);
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['repairs'] });
  };
  if (editing) return <IssueDialog issue={i} onClose={() => setEditing(false)} />;
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={i.title}>
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={SEV[i.severity].label} tone={SEV[i.severity].tone} />
          <Badge tone={i.status === 'open' ? 'warning' : i.status === 'fixed' ? 'success' : 'neutral'}>{i.status === 'wontfix' ? "Won't fix" : i.status === 'open' ? 'Open' : 'Fixed'}</Badge>
          {i.subsystem_text && <Badge>{i.subsystem_text}</Badge>}
          <TeamBadge teamId={i.team_id} />
        </div>
        <p className="text-[13px] text-muted">
          {formatDateTime(i.happened_at)}
          {i.event_label && ` · ${i.event_label}`} · reported by <Person id={i.reported_by} size="sm" />
          {i.fixed_by && (
            <>
              {' '}
              · fixed by <Person id={i.fixed_by} size="sm" />
            </>
          )}
        </p>
        {i.image_path && img.data?.get(i.image_path) && <img src={img.data.get(i.image_path)} alt="" className="max-h-80 w-full rounded-md object-contain" />}
        {i.cause && (
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">Why</p>
            <Markdown source={i.cause} className="text-[13.5px]" />
          </div>
        )}
        {i.fix && (
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">Fix</p>
            <Markdown source={i.fix} className="text-[13.5px]" />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {canManage && i.status === 'open' && (
            <Button size="sm" variant="primary" icon={<Check className="size-4" />} onClick={() => set('fixed')}>
              Mark fixed
            </Button>
          )}
          {canManage && i.status !== 'open' && (
            <Button size="sm" onClick={() => set('open')}>
              Reopen
            </Button>
          )}
          {canManage && i.status === 'open' && (
            <Button size="sm" variant="ghost" onClick={() => set('wontfix')}>
              Won't fix
            </Button>
          )}
          {isModuleEnabled('tasks') && i.status === 'open' && (
            <Button size="sm" icon={<SquarePlus className="size-4" />} onClick={() => nav(`/tasks?new=1&title=${encodeURIComponent(`Fix: ${i.title}`)}`)}>
              Create task from issue
            </Button>
          )}
          {canManage && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          <Slot name="repairs.issue.actions" props={{ issue: i }} />
        </div>
        {canManage && (
          <Button
            variant="ghost"
            className="text-danger"
            icon={<Trash2 className="size-4" />}
            onClick={async () => {
              if (!(await confirm({ title: 'Delete this issue?', danger: true, confirmLabel: 'Delete' }))) return;
              const { error } = await sb.from('rep_issues').delete().eq('id', i.id);
              if (error) return toast.error(friendlyError(error));
              qc.invalidateQueries({ queryKey: ['repairs'] });
              onClose();
            }}
          >
            Delete
          </Button>
        )}
        <CommentThread refStr={`repairs:issue:${i.id}`} />
      </div>
    </Sheet>
  );
}
