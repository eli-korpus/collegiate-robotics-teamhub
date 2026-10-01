import { SquareCheckBig } from 'lucide-react';
import { createElement } from 'react';
import type { CalendarOverlayItem, IntegrationClient } from '@teamhub/sdk';
import { parseDate, toDateInput } from '@teamhub/ui';

/** Overlay pattern (spec §4.4): read task due dates, store nothing. */
const client: IntegrationClient = {
  id: 'tasks+calendar',
  calendarOverlays: [
    async (sb, { from, to }) => {
      const { data } = await sb
        .from('task_items')
        .select('id, title, due, team_id, status')
        .neq('status', 'done')
        .gte('due', toDateInput(from))
        .lt('due', toDateInput(to));
      return (data ?? []).map(
        (t): CalendarOverlayItem => ({
          id: `task:${t.id}`,
          title: `Due: ${t.title}`,
          start: parseDate(t.due),
          allDay: true,
          color: '#64748B',
          icon: createElement(SquareCheckBig),
          meta: 'Task',
          href: `/tasks?item=${t.id}`,
          teamId: t.team_id,
        }),
      );
    },
  ],
};
export default client;
