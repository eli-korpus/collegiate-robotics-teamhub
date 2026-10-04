import { ProgressRing } from '@teamhub/ui';
import { usePeople } from '@teamhub/sdk';
import { hours, statsFor, useAttSettings, usePresence, useSeasonSessions } from '../data';

/** Profile section: attendance % and hours: visible to the person and to view_all holders (spec §13.1). */
export default function AttendanceProfile({ userId }: { userId: string }) {
  const people = usePeople();
  const sessions = useSeasonSessions();
  const presence = usePresence(sessions.data?.map((s) => s.id), userId);
  const settings = useAttSettings();
  const p = people.data?.get(userId);
  if (!p || !sessions.data || !presence.data) return null;
  const st = statsFor(p, sessions.data, presence.data, true);
  return (
    <div className="flex items-center gap-4">
      <ProgressRing value={st.pct ?? 0} size={56}>
        {st.pct == null ? '–' : `${Math.round(st.pct * 100)}%`}
      </ProgressRing>
      <div className="text-[13px]">
        <p>
          {st.attended} of {st.expected} practices this season
        </p>
        {settings.trackHours && <p className="text-muted">{hours(st.hoursMs)} hours</p>}
      </div>
    </div>
  );
}
