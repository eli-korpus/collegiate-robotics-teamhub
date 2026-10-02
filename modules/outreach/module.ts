import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('outreach', {
  create_event: { label: 'Add outreach events', default: ['captain', 'mentor'], simple: true },
  log_hours: { label: 'Log your own outreach hours', default: ['member', 'captain', 'mentor'] },
  approve_hours: { label: 'Approve outreach hours', default: ['mentor'], positions: ['pos_outreach_lead'], simple: true },
});

export default defineModule({
  id: 'outreach',
  prefix: 'out_',
  name: 'Outreach Log',
  category: 'outreach',
  icon: 'HeartHandshake',
  summary: 'Log outreach events, volunteer hours and people reached — totals ready for awards and grants.',
  purpose: 'Log outreach events, hours and people reached.',
  notFor: [
    { text: 'Scheduling in general (outreach shows on the calendar automatically)', goTo: 'calendar' },
    { text: 'Photos', goTo: 'media' },
  ],
  footprint: 'Tiny',
  stores: 'Outreach events and each person’s hours.',
  settings: z.object({
    kinds: z
      .array(z.string().min(1).max(40))
      .default(['Demo', 'Workshop', 'Mentoring', 'Community service', 'STEM fair', 'Fundraiser'])
      .meta({ title: 'Kinds of outreach' }),
  }),
  permissions,
  suggestedPositions: ['Outreach Lead'],
  entities: ['event'],
  buckets: [],
  toolLinkSlots: [],
  widgets: [
    { id: 'season', title: 'Season outreach', defaultFor: ['member', 'captain', 'mentor'] },
    { id: 'approve', title: 'Hours to approve', defaultFor: ['mentor'] },
  ],
  exportTables: ['out_events', 'out_hours'],
});
