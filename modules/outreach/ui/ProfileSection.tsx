import { useSeason } from '@teamhub/sdk';
import { round, useHours, useOutEvents } from './data';

export default function OutreachHours({ userId }: { userId: string }) {
  const season = useSeason();
  const events = useOutEvents(season);
  const hours = useHours();
  const ids = new Set((events.data ?? []).map((e) => e.id));
  const mine = (hours.data ?? []).filter((h) => h.user_id === userId && ids.has(h.event_id));
  const approved = round(mine.filter((h) => h.approved).reduce((n, h) => n + Number(h.hours), 0));
  const pending = round(mine.filter((h) => !h.approved).reduce((n, h) => n + Number(h.hours), 0));
  return (
    <p className="text-[13.5px]">
      <span className="tabular text-[18px] font-semibold">{approved} h</span> <span className="text-muted">this season across {mine.length} event{mine.length === 1 ? '' : 's'}</span>
      {pending > 0 && <span className="text-warning"> · {pending} h waiting for approval</span>}
    </p>
  );
}
