import { Link } from 'react-router';
import { DueDate } from '@teamhub/ui';
import { useTasks } from './shared';

export default function TasksProfile({ userId }: { userId: string }) {
  const tasks = useTasks();
  const open = (tasks.data ?? []).filter((t) => t.status !== 'done' && t.assignee.includes(userId));
  const done = (tasks.data ?? []).filter((t) => t.status === 'done' && t.assignee.includes(userId)).length;
  return (
    <div className="space-y-2 text-[13px]">
      <p className="text-muted">
        {open.length} open · {done} done recently
      </p>
      <ul className="space-y-1">
        {open.slice(0, 5).map((t) => (
          <li key={t.id} className="flex items-center gap-2">
            <Link to={`/tasks?item=${t.id}`} className="min-w-0 flex-1 truncate hover:underline">
              {t.title}
            </Link>
            <DueDate date={t.due} />
          </li>
        ))}
      </ul>
    </div>
  );
}
