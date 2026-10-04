import { Link } from 'react-router';
import { SquareCheckBig } from 'lucide-react';
import { Card, CardHeader, DueDate, dueBucket } from '@teamhub/ui';
import { useMe } from '@teamhub/sdk';
import { useTasks } from '../ui/shared';

/** Today strip: your overdue tasks and tasks due within a week. */
export default function MyTasks({ teamId }: { teamId: string | null }) {
  const me = useMe();
  const tasks = useTasks();
  const mine = (tasks.data ?? [])
    .filter((t) => t.status !== 'done' && t.assignee.includes(me.id) && (!teamId || !t.team_id || t.team_id === teamId))
    .filter((t) => ['overdue', 'today', 'week'].includes(dueBucket(t.due)))
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));
  if (!mine.length) return null;
  return (
    <Card>
      <CardHeader icon={<SquareCheckBig className="size-4" />} title={`${mine.length} task${mine.length === 1 ? '' : 's'} due soon`} action={<Link to="/tasks" className="text-[12px] font-medium text-accent">All tasks</Link>} />
      <ul className="space-y-1 px-2 pb-3">
        {mine.slice(0, 4).map((t) => (
          <li key={t.id}>
            <Link to={`/tasks?item=${t.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-bg-subtle">
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <DueDate date={t.due} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
