import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Flag, Trash2 } from 'lucide-react';
import { AvatarStack, Badge, Button, Checkbox, Dialog, DueDate, Field, Input, Select, Sheet, Textarea, toast, useConfirm, Markdown, RelativeTime, validateRequired } from '@teamhub/ui';
import {
  canWith,
  CommentThread,
  friendlyError,
  ModulePurpose,
  Person,
  PersonPicker,
  ScopeVisibility,
  Slot,
  TeamBadge,
  TeamScopePicker,
  useModuleSettings,
  usePeople,
  usePositions,
  useMe,
  useRows,
  useSubteams,
  useSupabase,
  useTeamScope,
} from '@teamhub/sdk';

export type Status = 'todo' | 'doing' | 'review' | 'done';
export interface Task {
  id: number;
  team_id: string | null;
  title: string;
  description: string | null;
  status: Status;
  assignee: string[];
  subteam_id: string | null;
  position_id: string | null;
  due: string | null;
  priority: number;
  sort: number;
  created_by: string | null;
  created_at: string;
  done_at: string | null;
}

export interface TaskSettings {
  labelTodo: string;
  labelDoing: string;
  labelReview: string;
  labelDone: string;
}

export function useStatusLabels(): Record<Status, string> {
  const s = useModuleSettings<TaskSettings>('tasks');
  return { todo: s.labelTodo ?? 'To do', doing: s.labelDoing ?? 'Doing', review: s.labelReview ?? 'Review', done: s.labelDone ?? 'Done' };
}

export const PRIORITY = [
  { v: 0, label: 'Low', tone: 'neutral' as const },
  { v: 1, label: 'Normal', tone: 'neutral' as const },
  { v: 2, label: 'High', tone: 'warning' as const },
  { v: 3, label: 'Urgent', tone: 'danger' as const },
];

export function useTasks(showArchived = false) {
  const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString();
  return useRows<Task>(['tasks', 'list', showArchived], (sb) => {
    let q = sb.from('task_items').select('*').order('sort').order('id');
    if (!showArchived) q = q.or(`status.neq.done,done_at.gte.${cutoff}`);
    return q;
  });
}

export function canEditTask(me: ReturnType<typeof useMe>, t: Task): boolean {
  return canWith(me, 'tasks.edit_any', t.team_id) || (t.created_by === me.id && canWith(me, 'tasks.create', t.team_id)) || t.assignee.includes(me.id);
}

export function PriorityFlag({ p }: { p: number }) {
  if (p < 2) return null;
  const P = PRIORITY[p];
  return (
    <Badge tone={P.tone}>
      <Flag className="size-3" /> {P.label}
    </Badge>
  );
}

export function TaskCardBody({ t }: { t: Task }) {
  const people = usePeople();
  const subteams = useSubteams();
  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-medium leading-snug">{t.title}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityFlag p={t.priority} />
        {t.subteam_id && <Badge>{subteams.find((s) => s.id === t.subteam_id)?.name ?? t.subteam_id}</Badge>}
        <DueDate date={t.due} done={t.status === 'done'} />
        <span className="flex-1" />
        <AvatarStack people={t.assignee.map((id) => ({ name: people.data?.get(id)?.name ?? '?', src: people.data?.get(id)?.avatarUrl }))} size={20} />
      </div>
    </div>
  );
}

export function TaskDialog({ task, onClose, draft }: { task?: Task | null; onClose: () => void; draft?: Partial<Task> }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const scope = useTeamScope();
  const subteams = useSubteams();
  const positions = usePositions();
  const [v, setV] = useState({
    title: task?.title ?? draft?.title ?? '',
    description: task?.description ?? draft?.description ?? '',
    team_id: task ? task.team_id : (draft?.team_id ?? scope),
    assignee: task?.assignee ?? draft?.assignee ?? [],
    due: task?.due ?? '',
    priority: task?.priority ?? 1,
    subteam_id: task?.subteam_id ?? '',
    position_id: task?.position_id ?? '',
  });
  const [busy, setBusy] = useState(false);
  const canAssign = canWith(me, 'tasks.assign', v.team_id);
  const save = async () => {
    if (!validateRequired()) return;
    if (!v.title.trim()) return toast.error('Give the task a title');
    setBusy(true);
    const row = { ...v, title: v.title.trim(), description: v.description.trim() || null, due: v.due || null, subteam_id: v.subteam_id || null, position_id: v.position_id || null };
    const res = task ? await sb.from('task_items').update(row).eq('id', task.id) : await sb.from('task_items').insert({ ...row, created_by: me.id, sort: Date.now() / 1e6 });
    setBusy(false);
    if (res.error) return toast.error(friendlyError(res.error));
    qc.invalidateQueries({ queryKey: ['tasks'] });
    toast.success(task ? 'Task updated' : 'Task created');
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(x) => !x && onClose()}
      title={task ? 'Edit task' : 'New task'}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={save}>
            {task ? 'Save' : 'Create task'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!task && <ModulePurpose moduleId="tasks" compact />}
        <TeamScopePicker value={v.team_id} onChange={(team_id) => setV({ ...v, team_id })} perm="tasks.create" />
        <Field label="Title" required>{(id) => <Input id={id} autoFocus maxLength={200} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />}</Field>
        <Field label="Details" optional>
          {(id) => <Textarea id={id} rows={4} maxLength={5000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Assigned to" optional>
            {() =>
              canAssign ? (
                <PersonPicker multiple max={5} value={v.assignee} onChange={(assignee) => setV({ ...v, assignee })} teamId={v.team_id} placeholder="Nobody yet" />
              ) : (
                <Checkbox checked={v.assignee.includes(me.id)} onChange={(on) => setV({ ...v, assignee: on ? [me.id] : [] })} label="Assign to me" />
              )
            }
          </Field>
          <Field label="Due" optional>{(id) => <Input id={id} type="date" value={v.due} onChange={(e) => setV({ ...v, due: e.target.value })} />}</Field>
          <Field label="Priority">
            {(id) => (
              <Select id={id} value={v.priority} onChange={(e) => setV({ ...v, priority: Number(e.target.value) })}>
                {PRIORITY.map((p) => (
                  <option key={p.v} value={p.v}>
                    {p.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {subteams.length > 0 && (
            <Field label="Subteam" optional>
              {(id) => (
                <Select id={id} value={v.subteam_id} onChange={(e) => setV({ ...v, subteam_id: e.target.value })}>
                  <option value="">None</option>
                  {subteams.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          {(positions.data?.length ?? 0) > 0 && (
            <Field label="Owned by position" optional hint="e.g. Lead Programmer">
              {(id) => (
                <Select id={id} value={v.position_id} onChange={(e) => setV({ ...v, position_id: e.target.value })}>
                  <option value="">None</option>
                  {positions.data!.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
        </div>
        <ScopeVisibility teamId={v.team_id} />
      </div>
    </Dialog>
  );
}

export function TaskSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const labels = useStatusLabels();
  const subteams = useSubteams();
  const positions = usePositions();
  const [editing, setEditing] = useState(false);
  const editable = canEditTask(me, task);
  const canDelete = canWith(me, 'tasks.delete_any', task.team_id) || (task.created_by === me.id && canWith(me, 'tasks.create', task.team_id));
  const setStatus = async (status: Status) => {
    const { error } = await sb.from('task_items').update({ status }).eq('id', task.id);
    if (error) toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['tasks'] });
  };
  if (editing) return <TaskDialog task={task} onClose={() => setEditing(false)} />;
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={task.title} width="w-[min(100vw,560px)]">
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={task.status} disabled={!editable} onChange={(e) => setStatus(e.target.value as Status)} className="w-40" aria-label="Status">
            {(Object.keys(labels) as Status[]).map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </Select>
          <PriorityFlag p={task.priority} />
          <DueDate date={task.due} done={task.status === 'done'} />
          <TeamBadge teamId={task.team_id} />
          <span className="flex-1" />
          {editable && (
            <Button size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (!(await confirm({ title: 'Delete this task?', danger: true, confirmLabel: 'Delete' }))) return;
                const { error } = await sb.from('task_items').delete().eq('id', task.id);
                if (error) return toast.error(friendlyError(error));
                qc.invalidateQueries({ queryKey: ['tasks'] });
                onClose();
              }}
            >
              Delete
            </Button>
          )}
        </div>
        {task.description && <Markdown source={task.description} />}
        <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-[13px]">
          <dt className="text-muted">Assigned to</dt>
          <dd className="flex flex-wrap gap-2">{task.assignee.length ? task.assignee.map((id) => <Person key={id} id={id} size="sm" />) : <span className="text-faint">Nobody</span>}</dd>
          {task.subteam_id && (
            <>
              <dt className="text-muted">Subteam</dt>
              <dd>{subteams.find((s) => s.id === task.subteam_id)?.name}</dd>
            </>
          )}
          {task.position_id && (
            <>
              <dt className="text-muted">Position</dt>
              <dd>{positions.data?.find((p) => p.id === task.position_id)?.name}</dd>
            </>
          )}
          <dt className="text-muted">Created</dt>
          <dd className="flex items-center gap-2">
            <Person id={task.created_by} size="sm" /> <RelativeTime date={task.created_at} className="text-faint" />
          </dd>
        </dl>
        {!task.assignee.includes(me.id) && editable && canWith(me, 'tasks.create', task.team_id) && (
          <Button
            size="sm"
            onClick={async () => {
              const { error } = await sb.from('task_items').update({ assignee: [...task.assignee, me.id].slice(0, 5) }).eq('id', task.id);
              if (error) toast.error(friendlyError(error));
              qc.invalidateQueries({ queryKey: ['tasks'] });
            }}
          >
            Take this task
          </Button>
        )}
        <Slot name="tasks.task.actions" props={{ task }} wrap={(c) => <div className="flex flex-wrap gap-2">{c}</div>} />
        <CommentThread refStr={`tasks:task:${task.id}`} />
      </div>
    </Sheet>
  );
}
