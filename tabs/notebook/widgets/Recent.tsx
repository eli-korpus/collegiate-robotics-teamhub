import { Link } from 'react-router';
import { NotebookPen } from 'lucide-react';
import { Card, CardHeader, formatDate } from '@teamhub/ui';
import { useEntries } from '../ui/data';

/** Home widget: notebook entries this week (keeps documentation habits visible). */
export default function RecentEntries({ teamId }: { teamId: string | null }) {
  const entries = useEntries();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const list = (entries.data ?? []).filter((e) => e.date >= weekAgo && (!teamId || !e.team_id || e.team_id === teamId));
  // Nothing written this week: no card (the Notebook tab is one click away).
  if (!list.length) return null;
  return (
    <Card>
      <CardHeader icon={<NotebookPen className="size-4" />} title="Notebook this week" subtitle={`${list.length} entr${list.length === 1 ? 'y' : 'ies'}`} action={<Link to="/notebook?new=1" className="text-[12px] font-medium text-accent">Write</Link>} />
      <ul className="space-y-0.5 px-2 pb-3">
        {list.slice(0, 4).map((e) => (
          <li key={e.id}>
            <Link to={`/notebook?item=${e.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-bg-subtle">
              <span className="min-w-0 flex-1 truncate">{e.title}</span>
              <span className="text-[11.5px] text-faint">{formatDate(e.date)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
