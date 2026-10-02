import { Megaphone } from 'lucide-react';
import { createElement } from 'react';
import type { CalendarOverlayItem, IntegrationClient } from '@teamhub/sdk';

const client: IntegrationClient = {
  id: 'social+calendar',
  calendarOverlays: [
    async (sb, { from, to }) => {
      const { data } = await sb.from('soc_posts').select('id, caption, platforms, scheduled_for, team_id').eq('status', 'scheduled').gte('scheduled_for', from.toISOString()).lt('scheduled_for', to.toISOString());
      return (data ?? []).map(
        (p): CalendarOverlayItem => ({
          id: `social:${p.id}`,
          title: `Post: ${p.caption.split('\n')[0].slice(0, 60) || 'social post'}`,
          start: new Date(p.scheduled_for),
          color: '#9333EA',
          icon: createElement(Megaphone),
          meta: (p.platforms as string[]).join(', ') || 'Social',
          href: `/social?item=${p.id}`,
          teamId: p.team_id,
        }),
      );
    },
  ],
};
export default client;
