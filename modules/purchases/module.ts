import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('purchases', {
  request: { label: 'Request purchases', default: ['member', 'captain', 'mentor'], simple: true },
  order: { label: 'Order items and mark them received', default: ['mentor'], simple: true },
  decline: { label: 'Decline requests', default: ['mentor'] },
});

export default defineModule({
  id: 'purchases',
  prefix: 'pur_',
  name: 'Purchase Requests',
  category: 'engineering',
  icon: 'ShoppingCart',
  summary: 'Ask a mentor to buy something and follow its status.',
  purpose: 'Ask a mentor to buy something, and see its status.',
  notFor: [
    { text: 'Budgets or accounting', goTo: 'link:drive' },
    { text: 'General to-dos', goTo: 'tasks' },
    { text: 'Getting a part made', goTo: 'manufacture' },
  ],
  footprint: 'Tiny (a few KB per season)',
  stores: 'Requests (item, link, quantity, estimated price, reason) and their order status. No budgets.',
  settings: z.object({}),
  permissions,
  suggestedPositions: [],
  entities: ['request'],
  buckets: [],
  toolLinkSlots: ['drive'],
  widgets: [{ id: 'to-order', title: 'Purchases to order', defaultFor: ['mentor'] }],
  commentEntities: ['request'],
  refVisibility: { request: 'exists (select 1 from pur_requests r where r.id::text = {id} and teamhub_in_team(r.team_id))' },
  exportTables: ['pur_requests'],
});
