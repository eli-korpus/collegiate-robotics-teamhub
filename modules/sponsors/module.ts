import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('sponsors', {
  view: { label: 'See sponsors', default: ['captain', 'mentor'], simple: true },
  manage: { label: 'Add and edit sponsors', default: ['captain', 'mentor'] },
});

export default defineModule({
  id: 'sponsors',
  prefix: 'spn_',
  name: 'Sponsors CRM',
  category: 'outreach',
  icon: 'Handshake',
  summary: 'Track sponsor asks, commitments, thank-yous and follow-ups.',
  purpose: 'Track sponsor relationships and follow-ups.',
  notFor: [{ text: 'Money accounting (write “what they gave” in words)', goTo: 'link:budget' }],
  footprint: 'Tiny',
  stores: 'Sponsor names, contacts, status and next steps. Captains and mentors only.',
  settings: z.object({}),
  permissions,
  suggestedPositions: [],
  entities: ['sponsor'],
  buckets: [],
  toolLinkSlots: [],
  viewPerm: 'sponsors.view',
  widgets: [{ id: 'followups', title: 'Sponsor follow-ups due', defaultFor: ['captain', 'mentor'] }],
  exportTables: ['spn_sponsors'],
});
