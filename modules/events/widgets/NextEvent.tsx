import { Link } from 'react-router';
import { Trophy } from 'lucide-react';
import { seasonYear } from '@teamhub/config-schema/util';
import { Card, CardHeader, daysBetween, formatDate, parseDate } from '@teamhub/ui';
import { runtime, useFtcTeamEvents, useSeason } from '@teamhub/sdk';

/** "Next event in 9 days" / "Last event: Rank 4". */
export default function NextEvent({ teamId }: { teamId: string | null }) {
  const teams = runtime().config.teams.filter((t) => t.number);
  const team = teams.find((t) => t.id === teamId) ?? teams[0];
  const season = seasonYear(useSeason());
  const events = useFtcTeamEvents(team?.number, season);
  if (!team || !events.data) return null;
  const now = new Date();
  const next = events.data.find((e) => parseDate(e.event.end) >= now && !e.event.finished);
  const last = [...events.data].reverse().find((e) => e.stats);
  if (!next && !last) return null;
  return (
    <Card>
      <CardHeader icon={<Trophy className="size-4" />} title={next ? 'Next event' : 'Last event'} subtitle={teams.length > 1 ? `${team.name} #${team.number}` : undefined} />
      <Link to={`/events/${season}/${(next ?? last)!.eventCode}`} className="block px-4 pb-4">
        <p className="font-semibold">{(next ?? last)!.event.name}</p>
        {next ? (
          <p className="text-[13px] text-muted">
            {daysBetween(now, parseDate(next.event.start)) <= 0 ? 'Happening now' : `In ${daysBetween(now, parseDate(next.event.start))} days`} · {formatDate(next.event.start)}
          </p>
        ) : (
          <p className="text-[13px] text-muted">
            Rank {last!.stats!.rank ?? '—'} · {last!.stats!.wins}-{last!.stats!.losses}
            {last!.awards.length ? ` · ${last!.awards.length} award${last!.awards.length > 1 ? 's' : ''}` : ''}
          </p>
        )}
      </Link>
    </Card>
  );
}
