import { Link } from 'react-router';
import { ClipboardPen } from 'lucide-react';
import { Card, CardHeader, formatDate } from '@teamhub/ui';
import { useMe } from '@teamhub/sdk';
import { isOpen, useClaims, useSheets, useSlots } from './Routes';

/** Your upcoming sign-ups, plus open sheets with free spots. */
export default function MySignups({ teamId }: { teamId: string | null }) {
  const me = useMe();
  const sheets = useSheets();
  const slots = useSlots();
  const claims = useClaims();
  const mine = (claims.data ?? []).filter((c) => c.user_id === me.id).map((c) => slots.data?.find((s) => s.id === c.slot_id)).filter((s) => s && (!s.starts_at || new Date(s.starts_at) > new Date()));
  const open = (sheets.data ?? []).filter((s) => isOpen(s) && (!teamId || !s.team_id || s.team_id === teamId)).filter((s) => {
    const sl = (slots.data ?? []).filter((x) => x.sheet_id === s.id);
    const taken = (claims.data ?? []).filter((c) => sl.some((x) => x.id === c.slot_id));
    return taken.length < sl.reduce((n, x) => n + x.capacity, 0) && !taken.some((c) => c.user_id === me.id);
  });
  if (!mine.length && !open.length) return null;
  return (
    <Card>
      <CardHeader icon={<ClipboardPen className="size-4" />} title="Sign-ups" />
      <ul className="space-y-1 px-2 pb-3 text-[13px]">
        {mine.slice(0, 3).map((s) => {
          const sheet = sheets.data?.find((x) => x.id === s!.sheet_id);
          return (
            <li key={s!.id}>
              <Link to={`/signups?item=${s!.sheet_id}`} className="block truncate rounded-md px-2 py-1.5 hover:bg-bg-subtle">
                <span className="font-medium">{s!.label}</span> · {sheet?.title}
                {s!.starts_at && <span className="text-muted"> · {formatDate(s!.starts_at)}</span>}
              </Link>
            </li>
          );
        })}
        {open.slice(0, 3).map((s) => (
          <li key={s.id}>
            <Link to={`/signups?item=${s.id}`} className="block truncate rounded-md px-2 py-1.5 text-muted hover:bg-bg-subtle">
              Spots open: <span className="text-fg">{s.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
