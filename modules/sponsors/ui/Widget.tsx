import { Link } from 'react-router';
import { Handshake } from 'lucide-react';
import { Card, CardHeader, DueDate, addDays, toDateInput } from '@teamhub/ui';
import { useCan } from '@teamhub/sdk';
import { useSponsors } from './Routes';

/** Follow-ups due in the next week (or overdue), and unthanked committed sponsors. */
export default function FollowUpsDue({ teamId }: { teamId: string | null }) {
  const canManage = useCan('sponsors.manage');
  const can = useCan('sponsors.view') || canManage;
  const list = useSponsors(can);
  const soon = toDateInput(addDays(new Date(), 7));
  const rows = (list.data ?? []).filter((s) => (!teamId || !s.team_id || s.team_id === teamId) && ((s.next_step_date && s.next_step_date <= soon) || (s.status === 'committed' && !s.thanked)));
  if (!can || !rows.length) return null;
  return (
    <Card>
      <CardHeader icon={<Handshake className="size-4" />} title="Sponsor follow-ups due" />
      <ul className="space-y-1 px-2 pb-3 text-[13px]">
        {rows.slice(0, 4).map((s) => (
          <li key={s.id}>
            <Link to={`/sponsors?item=${s.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-bg-subtle">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{s.name}</span> · {s.next_step_date ? s.next_step : 'Say thank you'}
              </span>
              {s.next_step_date && <DueDate date={s.next_step_date} />}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
