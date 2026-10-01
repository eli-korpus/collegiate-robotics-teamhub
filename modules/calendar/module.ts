import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('calendar', {
  view: { label: 'See the calendar', default: ['member', 'captain', 'mentor'] },
  create: { label: 'Create events (and edit their own)', default: ['captain', 'mentor'], simple: true },
  edit_any: { label: "Edit or delete anyone's events", default: ['mentor'] },
});

export const settings = z.object({
  defaultView: z.enum(['month', 'week', 'agenda']).default('month').meta({ title: 'Default view on computers', description: 'Phones always start in Agenda view.' }),
});

export default defineModule({
  id: 'calendar',
  prefix: 'cal_',
  name: 'Calendar',
  category: 'team',
  icon: 'CalendarDays',
  summary: 'Practices, meetings, competitions and deadlines in one calendar.',
  purpose: 'When things happen — practices, meetings, competitions, deadlines and socials.',
  notFor: [
    { text: 'RSVPs or finding a time that works', goTo: 'polls' },
    { text: 'Claiming limited slots (drivers, snacks)', goTo: 'signups' },
    { text: 'Discussion', goTo: 'link:team_chat' },
  ],
  footprint: 'Tiny (a few KB per season)',
  stores: 'Events with optional repeat rules; iCal feed links for families.',
  settings,
  permissions,
  suggestedPositions: [],
  entities: ['event'],
  buckets: [],
  toolLinkSlots: ['team_chat'],
  widgets: [{ id: 'up-next', title: 'Up next', defaultFor: ['member', 'captain', 'mentor'] }],
  exportTables: ['cal_events', 'cal_exceptions'],
  functions: ['ical'],
});
