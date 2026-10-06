import { createElement } from 'react';
import { Link } from 'react-router';
import { Trophy } from 'lucide-react';
import { defaultSeasonLabel, seasonYear } from '@teamhub/config-schema/util';
import { runtime, type CalendarOverlayItem, type IntegrationClient } from '@teamhub/sdk';
import { buttonClass, parseDate } from '@teamhub/ui';

/** "Results & matches" on a calendar competition: opens it in the Events tab. */
function ResultsLink({ event, occurrence }: { event: { kind: string; event_code: string | null }; occurrence: { start: Date } }) {
  if (event.kind !== 'competition' || !event.event_code) return null;
  const season = seasonYear(defaultSeasonLabel(occurrence.start));
  return createElement(Link, { to: `/events/${season}/${event.event_code}`, className: buttonClass('secondary', 'sm') }, createElement(Trophy, { className: 'size-4' }), 'Results & matches');
}

const client: IntegrationClient = {
  id: 'events+calendar',
  slots: { 'calendar.event.actions': ResultsLink },
  calendarOverlays: [
    async (sb, { from, to }) => {
      const { data } = await sb.from('teamhub_settings').select('season_label').eq('id', 1).maybeSingle();
      const season = seasonYear(data?.season_label ?? runtime().config.season);
      // Loaded on demand so FTCScout code stays out of the first page load.
      const { getTeamEvents } = await import('@teamhub/sdk/ftcscout');
      const out: CalendarOverlayItem[] = [];
      for (const t of runtime().config.teams.filter((x) => x.number)) {
        for (const e of await getTeamEvents(t.number!, season)) {
          const start = parseDate(e.event.start);
          const end = parseDate(e.event.end);
          if (end < from || start >= to) continue;
          out.push({
            id: `ftc:${t.id}:${e.eventCode}`,
            title: e.event.name,
            start,
            end: new Date(end.getTime() + 86_400_000),
            allDay: true,
            color: '#EF4444',
            icon: createElement(Trophy),
            meta: [e.event.location?.city, runtime().config.teams.length > 1 ? t.name : null].filter(Boolean).join(' · '),
            href: `/events/${season}/${e.eventCode}`,
            eventCode: e.eventCode,
            teamId: t.id,
          });
        }
      }
      return out;
    },
  ],
};
export default client;
