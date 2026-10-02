import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('inventory', {
  edit_qty: { label: 'Change quantities (take or return parts)', default: ['member', 'captain', 'mentor'] },
  manage: { label: 'Add, edit and delete parts', default: ['captain', 'mentor'], positions: ['pos_inventory_manager'], simple: true },
});

export const settings = z.object({
  perTeam: z.boolean().default(false).meta({ title: 'Separate inventory per team', description: 'Off = one shared inventory for the whole program.' }),
  categories: z.array(z.string()).default(['Motors & servos', 'Electronics', 'Structure', 'Hardware', 'Wheels & drivetrain', 'Tools', 'Other']).meta({ title: 'Categories' }),
});

export default defineModule({
  id: 'inventory',
  prefix: 'inv_',
  name: 'Parts Inventory',
  category: 'engineering',
  icon: 'Boxes',
  summary: 'What parts you have, how many, and which bin they are in.',
  purpose: 'What parts we have and where they are.',
  notFor: [
    { text: 'Buying parts', goTo: 'purchases' },
    { text: 'Batteries', goTo: 'batteries' },
  ],
  footprint: 'Tiny (~0.1 MB)',
  stores: 'Parts with SKU, vendor link, bin location, quantity and a low-stock level. No images.',
  settings,
  permissions,
  suggestedPositions: ['Inventory Manager'],
  entities: ['item'],
  buckets: [],
  toolLinkSlots: [],
  widgets: [{ id: 'low', title: 'Low stock', defaultFor: ['captain', 'mentor'] }],
  exportTables: ['inv_items'],
});
