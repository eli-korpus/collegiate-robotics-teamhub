import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SquareCheckBig } from 'lucide-react';
import {
  DataTable,
  DueDate,
  EmptyState,
  ErrorState,
  Kanban,
  KanbanCard,
  ListRow,
  Segmented,
  Select,
  SmartGroupList,
  Spinner,
  Switch,
  Toolbar,
  dueBucket,
  toast,
} from '@teamhub/ui';
import {
  friendlyError,
  ModuleHeader,
  ModuleNewMenu,
  ModulePurpose,
  Person,
  PersonPicker,
  useCan,
  useCreateShortcut,
  useLocalStorage,
  useMe,
  useNewParam,
  useSelectedParam,
  useSubteams,
  useSupabase,
  useTeamScope,
} from '@teamhub/sdk';
import { canEditTask, PriorityFlag, TaskCardBody, TaskDialog, TaskSheet, useStatusLabels, useTasks, type Status, type Task } from './shared';

type View = 'mine' | 'board' | 'list';

export default function TasksRoutes() {
  const me = useMe();
  const canCreate = useCan('tasks.create');
  const [view, setView] = useLocalStorage<View>('teamhub-tasks-view', 'mine');
  const [archived, setArchived] = useState(false);
  const [who, setWho] = useState<string[]>([]);
  const [subteam, setSubteam] = useState('');
  const tasks = useTasks(archived);
  const scope = useTeamScope();
  const subteams = useSubteams();
  const [creating, setCreating, params] = useNewParam();
  const [selected, setSelected] = useSelectedParam();
  useCreateShortcut(() => setCreating(true), canCreate);

  const list = (tasks.data ?? []).filter(
    (t) => (!scope || !t.team_id || t.team_id === scope) && (!who.length || t.assignee.some((a) => who.includes(a))) && (!subteam || t.subteam_id === subteam),
  );
  const current = (tasks.data ?? []).find((t) => String(t.id) === selected) ?? null;

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader moduleId="tasks" actions={canCreate && <ModuleNewMenu moduleId="tasks" label="New task" onNew={() => setCreating(true)} />}>
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'mine', label: 'My tasks' },
            { value: 'board', label: 'Board' },
            { value: 'list', label: 'All tasks' },
          ]}
        />
      </ModuleHeader>
      {view !== 'mine' && (
        <Toolbar>
          <div className="w-60">
            <PersonPicker multiple value={who} onChange={setWho} placeholder="Anyone" label="Filter by person" />
          </div>
          {subteams.length > 0 && (
            <Select value={subteam} onChange={(e) => setSubteam(e.target.value)} className="w-44" aria-label="Filter by subteam">
              <option value="">All subteams</option>
              {subteams.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
          <span className="flex-1" />
          <Switch checked={archived} onChange={setArchived} label={<span className="text-[12.5px] font-normal">Show done &gt; 60 days</span>} />
        </Toolbar>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {tasks.isLoading ? (
          <Spinner className="m-8" />
        ) : tasks.error ? (
          <ErrorState error={tasks.error} retry={() => tasks.refetch()} />
        ) : view === 'board' ? (
          <Board tasks={list} onOpen={(t) => setSelected(String(t.id))} />
        ) : view === 'mine' ? (
          <Mine tasks={list.filter((t) => t.assignee.includes(me.id))} onOpen={(t) => setSelected(String(t.id))} canCreate={canCreate} />
        ) : (
          <div className="p-4 sm:px-6">
            <AllList tasks={list} onOpen={(t) => setSelected(String(t.id))} />
          </div>
        )}
      </div>
      {creating && <TaskDialog onClose={() => setCreating(false)} draft={{ title: params.get('title') ?? undefined }} />}
      {current && <TaskSheet task={current} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Board({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const labels = useStatusLabels();
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const cols: { id: Status; tone: string }[] = [
    { id: 'todo', tone: '#94a3b8' },
    { id: 'doing', tone: '#3b82f6' },
    { id: 'review', tone: '#f59e0b' },
    { id: 'done', tone: '#22c55e' },
  ];
  return (
    <Kanban
      columns={cols.map((c) => ({ id: c.id, title: labels[c.id], tone: c.tone, items: tasks.filter((t) => t.status === c.id) }))}
      keyOf={(t) => t.id}
      canDrag={(t) => canEditTask(me, t)}
      render={(t) => (
        <KanbanCard onClick={() => onOpen(t)}>
          <TaskCardBody t={t} />
        </KanbanCard>
      )}
      onMove={async (t, to, index) => {
        const col = tasks.filter((x) => x.status === to && x.id !== t.id);
        const before = col[index - 1]?.sort;
        const after = col[index]?.sort;
        const sort = before != null && after != null ? (before + after) / 2 : before != null ? before + 1 : after != null ? after - 1 : 0;
        qc.setQueryData<Task[]>(['tasks', 'list', false], (old) => old?.map((x) => (x.id === t.id ? { ...x, status: to as Status, sort } : x)));
        const { error } = await sb.from('task_items').update({ status: to, sort }).eq('id', t.id);
        if (error) toast.error(friendlyError(error));
        qc.invalidateQueries({ queryKey: ['tasks'] });
      }}
    />
  );
}

function Mine({ tasks, onOpen, canCreate }: { tasks: Task[]; onOpen: (t: Task) => void; canCreate: boolean }) {
  const open = tasks.filter((t) => t.status !== 'done');
  const groups = useMemo(
    () => [
      { id: 'overdue', title: 'Overdue', tone: 'danger' as const, items: open.filter((t) => dueBucket(t.due) === 'overdue') },
      { id: 'today', title: 'Today', items: open.filter((t) => dueBucket(t.due) === 'today') },
      { id: 'week', title: 'This week', items: open.filter((t) => dueBucket(t.due) === 'week') },
      { id: 'later', title: 'Later', items: open.filter((t) => dueBucket(t.due) === 'later') },
      { id: 'none', title: 'No due date', items: open.filter((t) => dueBucket(t.due) === 'none') },
      { id: 'done', title: 'Done recently', items: tasks.filter((t) => t.status === 'done'), collapsed: true },
    ],
    [open, tasks],
  );
  return (
    <SmartGroupList
      groups={groups}
      keyOf={(t) => t.id}
      empty={
        <EmptyState
          icon={<SquareCheckBig />}
          title="Nothing assigned to you"
          body={
            <>
              Tasks assigned to you show up here, grouped by when they're due.
              <ModulePurpose moduleId="tasks" compact className="mt-3 text-left" />
            </>
          }
          action={canCreate ? undefined : undefined}
        />
      }
      render={(t) => (
        <ListRow onClick={() => onOpen(t)}>
          <div className="min-w-0 flex-1">
            <TaskCardBody t={t} />
          </div>
        </ListRow>
      )}
    />
  );
}

function AllList({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const labels = useStatusLabels();
  return (
    <DataTable
      rows={tasks}
      keyOf={(t) => t.id}
      empty={<EmptyState icon={<SquareCheckBig />} title="No tasks match" />}
      columns={[
        { id: 'title', header: 'Task', sort: (t) => t.title.toLowerCase(), cell: (t) => <button className="text-left font-medium hover:underline" onClick={() => onOpen(t)}>{t.title}</button> },
        { id: 'status', header: 'Status', sort: (t) => ['todo', 'doing', 'review', 'done'].indexOf(t.status), cell: (t) => labels[t.status] },
        { id: 'who', header: 'Assigned', cell: (t) => <span className="flex flex-wrap gap-1">{t.assignee.map((a) => <Person key={a} id={a} size="sm" />)}</span> },
        { id: 'due', header: 'Due', sort: (t) => t.due ?? '9999', cell: (t) => <DueDate date={t.due} done={t.status === 'done'} /> },
        { id: 'pri', header: 'Priority', sort: (t) => -t.priority, cell: (t) => <PriorityFlag p={t.priority} /> },
      ]}
    />
  );
}
