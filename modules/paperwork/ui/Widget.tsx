import { Link } from 'react-router';
import { FileWarning } from 'lucide-react';
import { Card, CardHeader, DueDate } from '@teamhub/ui';
import { canWith, useActivePeople, useMe, useSeason } from '@teamhub/sdk';
import { appliesTo, useDone, useItems } from './Routes';

/** "Paperwork you owe" for everyone; "Missing paperwork (n)" for markers. */
export default function Owed({ teamId }: { teamId: string | null }) {
  const me = useMe();
  const items = useItems(useSeason());
  const done = useDone();
  const people = useActivePeople(teamId);
  const list = (items.data ?? []).filter((i) => !teamId || !i.team_id || i.team_id === teamId);
  const isDone = (i: string, u: string) => (done.data ?? []).some((d) => d.item_id === i && d.user_id === u);
  const self = people.find((p) => p.id === me.id);
  const owed = self ? list.filter((i) => appliesTo(self, i) && !isDone(i.id, me.id)) : [];
  const marker = canWith(me, 'paperwork.mark');
  const missing = marker ? people.reduce((n, p) => n + list.filter((i) => appliesTo(p, i) && !isDone(i.id, p.id)).length, 0) : 0;
  if (!owed.length && !missing) return null;
  return (
    <Card>
      <CardHeader icon={<FileWarning className="size-4" />} title={owed.length ? 'Paperwork you still owe' : `Missing paperwork (${missing})`} action={<Link to="/paperwork" className="text-[12px] font-medium text-accent">Open</Link>} />
      <ul className="space-y-1 px-4 pb-4 text-[13px]">
        {owed.map((i) => (
          <li key={i.id} className="flex justify-between gap-2">
            <span>{i.name}</span>
            <DueDate date={i.due} />
          </li>
        ))}
        {!owed.length && <li className="text-muted">{missing} forms not turned in across the team.</li>}
      </ul>
    </Card>
  );
}
