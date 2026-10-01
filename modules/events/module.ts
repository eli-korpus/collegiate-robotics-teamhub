import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('events', {
  view: { label: 'See events & results', default: ['member', 'captain', 'mentor'] },
  notes: { label: "Write the team's notes for an event", default: ['captain', 'mentor'] },
});

export default defineModule({
  id: 'events',
  prefix: 'evt_',
  name: 'Events & Results',
  category: 'competition',
  icon: 'Trophy',
  summary: 'Your official events, rankings, matches and awards from FTCScout.',
  purpose: 'Official competition results and stats from FTCScout.',
  notFor: [
    { text: 'Entering results by hand', goTo: 'competition-day' },
    { text: 'Travel planning and discussion', goTo: 'link:team_chat' },
  ],
  footprint: 'Almost nothing (results come live from FTCScout)',
  stores: "Only the team's own short notes per event.",
  settings: z.object({}),
  permissions,
  suggestedPositions: [],
  entities: ['event'],
  buckets: [],
  toolLinkSlots: ['ftcscout', 'manual'],
  widgets: [{ id: 'next-event', title: 'Next / last event', defaultFor: ['member', 'captain', 'mentor'] }],
  exportTables: ['evt_notes'],
});
