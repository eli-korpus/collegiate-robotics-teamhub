import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('driver-practice', {
  log: { label: 'Log practice runs', default: ['member', 'captain', 'mentor'] },
  manage_fields: { label: 'Choose what to measure (custom metrics)', default: ['captain', 'mentor'], simple: true },
});

export default defineModule({
  id: 'driver-practice',
  prefix: 'drv_',
  name: 'Driver Practice',
  category: 'engineering',
  icon: 'Gamepad2',
  summary: 'Log practice runs and watch each driver pair improve.',
  purpose: 'Track our own practice driving performance.',
  notFor: [{ text: 'Scouting other teams', goTo: 'scouting' }],
  footprint: 'Tiny (~0.2 MB per season)',
  stores: 'Practice runs: drivers, scores and the metrics your team chooses.',
  settings: z.object({}),
  permissions,
  suggestedPositions: ['Drive Coach', 'Driver 1', 'Driver 2'],
  entities: ['run'],
  buckets: [],
  toolLinkSlots: [],
  widgets: [],
  exportTables: ['drv_fields', 'drv_runs'],
});
