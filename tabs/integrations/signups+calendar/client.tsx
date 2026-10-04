import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ClipboardPen } from 'lucide-react';
import { Button } from '@teamhub/ui';
import { canWith, makeRef, useMe, useSupabase, type IntegrationClient } from '@teamhub/sdk';

/** Sheets linked to this calendar event (via sign_sheets.event_ref), plus "Add sign-up sheet". */
function EventSheets({ event }: { event: { id: string; title: string; team_id: string | null } }) {
  const sb = useSupabase();
  const me = useMe();
  const nav = useNavigate();
  const ref = makeRef('calendar', 'event', event.id);
  const q = useQuery({
    queryKey: ['signups', 'for-event', ref],
    queryFn: async () => {
      const { data } = await sb.from('sign_sheets').select('id, title, sign_slots(capacity, sign_claims(user_id))').eq('event_ref', ref);
      return (data ?? []) as { id: string; title: string; sign_slots: { capacity: number; sign_claims: { user_id: string }[] }[] }[];
    },
  });
  const can = canWith(me, 'signups.create', event.team_id);
  return (
    <>
      {(q.data ?? []).map((s) => {
        const cap = s.sign_slots.reduce((n, x) => n + x.capacity, 0);
        const taken = s.sign_slots.reduce((n, x) => n + x.sign_claims.length, 0);
        return (
          <Link key={s.id} to={`/signups?item=${s.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[13px] hover:bg-bg-subtle">
            <ClipboardPen className="size-4" /> {s.title} · {taken}/{cap}
          </Link>
        );
      })}
      {can && (
        <Button size="sm" variant="ghost" icon={<ClipboardPen className="size-4" />} onClick={() => nav(`/signups?new=1&ref=${encodeURIComponent(ref)}&title=${encodeURIComponent(event.title)}`)}>
          Add sign-up sheet
        </Button>
      )}
    </>
  );
}

const client: IntegrationClient = { id: 'signups+calendar', slots: { 'calendar.event.actions': EventSheets } };
export default client;
