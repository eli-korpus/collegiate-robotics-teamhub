import { createElement } from 'react';
import { Trophy } from 'lucide-react';
import { seasonYear } from '@teamhub/config-schema';
import { getTeamEvents, runtime, type CalendarOverlayItem, type IntegrationClient } from '@teamhub/sdk';
import { parseDate } from '@teamhub/ui';

const client: IntegrationClient = {
  id: 'events+calendar',
  calendarOverlays: [
    async (sb, { from, to }) => {
      const { data } = await sb.from('teamhub_settings').select('season_label').eq('id', 1).maybeSingle();
      const season = seasonYear(data?.season_label ?? runtime().config.season);
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
