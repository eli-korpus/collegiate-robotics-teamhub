import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('batteries', {
  log: { label: 'Log charges, tests and use', default: ['member', 'captain', 'mentor'] },
  manage: { label: 'Add, retire and delete batteries', default: ['captain', 'mentor'], simple: true },
});

export const settings = z.object({
  chargedVolts: z.number().min(10).max(16).default(13.0).meta({ title: 'Charged at or above (V)' }),
  weakVolts: z.number().min(10).max(16).default(12.5).meta({ title: 'Weak below (V) after charging', description: 'A charged battery testing below this is flagged “consider retiring”.' }),
  staleHours: z.number().int().min(1).max(168).default(48).meta({ title: 'Recharge if last charge is older than (hours)' }),
});

export default defineModule({
  id: 'batteries',
  prefix: 'bat_',
  name: 'Battery Tracker',
  category: 'engineering',
  icon: 'BatteryCharging',
  summary: 'Know which batteries are charged, which need charging and which are getting weak.',
  purpose: 'Keep batteries charged and healthy.',
  notFor: [{ text: 'General parts inventory', goTo: 'inventory' }],
  footprint: 'Tiny (log trimmed to the last 200 entries per battery)',
  stores: 'Your batteries and a short log of charges, voltage tests and use.',
  settings,
  permissions,
  suggestedPositions: [],
  entities: ['battery'],
  buckets: [],
  toolLinkSlots: [],
  widgets: [{ id: 'needs-charge', title: 'Batteries to charge', defaultFor: ['member', 'captain', 'mentor'] }],
  exportTables: ['bat_batteries', 'bat_logs'],
});
