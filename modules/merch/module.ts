import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('merch', {
  order: { label: 'Place merch orders', default: ['member', 'captain', 'mentor'] },
  manage: { label: 'Run merch drives and see all orders', default: ['captain', 'mentor'], simple: true },
  mark_paid: { label: 'Mark orders paid', default: ['mentor'] },
});

export default defineModule({
  id: 'merch',
  prefix: 'mer_',
  name: 'Merch & Orders',
  category: 'outreach',
  icon: 'Shirt',
  summary: 'Collect team shirt and hoodie orders: sizes come from profiles.',
  purpose: 'Collect team merch orders.',
  notFor: [
    { text: 'Collecting sizes for other reasons', goTo: 'core:request-info' },
    { text: 'Taking payments (collect money outside TeamHub)', goTo: 'link:budget' },
  ],
  footprint: 'Tiny',
  stores: 'Order drives and each person’s order lines, plus paid/delivered checkboxes. Never payment details.',
  settings: z.object({}),
  permissions,
  suggestedPositions: [],
  entities: ['drive'],
  buckets: [],
  toolLinkSlots: [],
  widgets: [{ id: 'open', title: 'Merch orders open', defaultFor: ['member', 'captain', 'mentor'] }],
  exportTables: ['mer_drives', 'mer_orders'],
  seasonRollover: {
    describe: 'Deletes merch orders older than one year (export first).',
    sql: "delete from mer_orders where created_at < now() - interval '1 year'; delete from mer_drives d where d.created_at < now() - interval '1 year' and not exists (select 1 from mer_orders o where o.drive_id = d.id);",
  },
});
