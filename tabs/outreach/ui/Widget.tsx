import { Link } from 'react-router';
import { HeartHandshake } from 'lucide-react';
import { Card, CardHeader } from '@teamhub/ui';
import { useSeason } from '@teamhub/sdk';
import { totals, useHours, useOutEvents } from './data';

/** "Season outreach: 132 h, 1,240 people" (spec §13.24). */
export default function SeasonOutreach({ teamId }: { teamId: string | null }) {
  const season = useSeason();
  const events = useOutEvents(season);
  const hours = useHours();
  const list = (events.data ?? []).filter((e) => !teamId || !e.team_id || e.team_id === teamId);
  if (!list.length) return null;
  const t = totals(list, hours.data ?? []);
  return (
    <Card>
      <CardHeader icon={<HeartHandshake className="size-4" />} title="Season outreach" action={<Link to="/outreach" className="text-[12.5px] text-accent hover:underline">Log</Link>} />
      <p className="px-4 pb-4 text-[15px]">
        <span className="tabular text-[22px] font-semibold">{t.hours} h</span> <span className="text-muted">volunteered,</span> <span className="tabular text-[22px] font-semibold">{t.people.toLocaleString()}</span>{' '}
        <span className="text-muted">people reached across {t.events} event{t.events === 1 ? '' : 's'}</span>
      </p>
    </Card>
  );
}
