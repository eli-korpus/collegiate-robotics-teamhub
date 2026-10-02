import { HeartHandshake } from 'lucide-react';
import { createElement } from 'react';
import type { CalendarOverlayItem, IntegrationClient } from '@teamhub/sdk';
import { parseDate, toDateInput } from '@teamhub/ui';

const client: IntegrationClient = {
  id: 'outreach+calendar',
  calendarOverlays: [
    async (sb, { from, to }) => {
      const { data } = await sb.from('out_events').select('id, title, date, starts_at, ends_at, location, team_id').gte('date', toDateInput(from)).lt('date', toDateInput(to));
      return (data ?? []).map(
        (e): CalendarOverlayItem => ({
          id: `outreach:${e.id}`,
          title: e.title,
          start: e.starts_at ? new Date(e.starts_at) : parseDate(e.date),
          end: e.ends_at ? new Date(e.ends_at) : null,
          allDay: !e.starts_at,
          color: '#DB2777',
          icon: createElement(HeartHandshake),
          meta: e.location ?? 'Outreach',
          href: `/outreach?item=${e.id}`,
          teamId: e.team_id,
        }),
      );
    },
  ],
};
export default client;
