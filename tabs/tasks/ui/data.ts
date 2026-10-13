import { canWith, useModuleSettings, useMe, useRows } from '@teamhub/sdk';

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
