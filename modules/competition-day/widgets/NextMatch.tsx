import { Link } from 'react-router';
import { Timer } from 'lucide-react';
import { Badge, Card, CardHeader, formatTime } from '@teamhub/ui';
import { matchLabel } from '@teamhub/sdk';
import { estimate, useActive, useLiveEvent, useOurTeam } from '../ui/Routes';

/** Today strip during an event: our next match with an estimated time. */
export default function NextMatch() {
  const team = useOurTeam();
  const active = useActive();
  const a = active.data?.find((x) => x.team_id === team?.id);
  const ev = useLiveEvent(a);
  if (!team || !a || !ev.data) return null;
  const next = ev.data.matches.filter((m) => !m.hasBeenPlayed && m.teams.some((t) => t.teamNumber === team.number)).sort((x, y) => x.id - y.id)[0];
  const us = ev.data.teams.find((t) => t.teamNumber === team.number);
  if (!next && !us?.stats) return null;
  const est = next ? estimate(next, ev.data.matches) : null;
  return (
    <Card>
      <CardHeader icon={<Timer className="size-4" />} title={ev.data.name} action={<Link to="/competition-day" className="text-[12px] font-medium text-accent">Open</Link>} />
      <div className="flex items-center gap-4 px-4 pb-4">
        {next && (
          <div>
            <p className="text-[24px] font-bold leading-none">{matchLabel(next)}</p>
            <p className="text-[12px] text-muted">
              {est ? `~${formatTime(est)}` : 'time TBA'} <Badge>est.</Badge>
            </p>
          </div>
        )}
        {us?.stats && (
          <p className="text-[13px] text-muted">
            Rank {us.stats.rank ?? '–'} · {us.stats.wins}-{us.stats.losses}-{us.stats.ties}
          </p>
        )}
      </div>
    </Card>
  );
}
