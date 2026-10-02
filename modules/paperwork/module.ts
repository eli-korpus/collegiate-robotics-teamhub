import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('paperwork', {
  manage: { label: 'Add and edit required paperwork', default: ['mentor'], simple: true },
  mark: { label: 'Check people off as turned in', default: ['mentor'], simple: true },
  view_all: { label: "See everyone's paperwork status", default: ['mentor'] },
});

export default defineModule({
  id: 'paperwork',
  prefix: 'ppr_',
  name: 'Paperwork Tracker',
  category: 'team',
  icon: 'FileCheck2',
  summary: 'Track who has turned in consent forms, travel permission and other paperwork.',
  purpose: 'Track who has turned in required paperwork.',
  notFor: [
    { text: 'Uploading or collecting the documents themselves', goTo: 'link:drive' },
    { text: 'Asking questions', goTo: 'core:request-info' },
  ],
  footprint: 'Tiny (a row only when something is turned in)',
  stores: 'The list of required forms and who has turned each in. Never the documents.',
  settings: z.object({}),
  permissions,
  suggestedPositions: [],
  entities: ['item'],
  buckets: [],
  toolLinkSlots: [],
  widgets: [{ id: 'owed', title: 'Paperwork you owe', defaultFor: ['member', 'captain', 'mentor'] }],
  exportTables: ['ppr_items', 'ppr_done'],
});
