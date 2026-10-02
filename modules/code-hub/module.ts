import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('code-hub', {
  view: { label: 'See the Code Hub', default: ['member', 'captain', 'mentor'] },
  edit: { label: 'Edit OpModes and controls', default: ['captain', 'mentor'], positions: ['pos_lead_programmer'], simple: true },
});

export default defineModule({
  id: 'code-hub',
  prefix: 'code_',
  name: 'Code Hub',
  category: 'engineering',
  icon: 'Code2',
  summary: "The software team's home: repo activity, OpModes and driver controls.",
  purpose: "The software team's home: repo activity, OpModes and controls.",
  notFor: [
    { text: 'Storing code', goTo: 'link:code_repo' },
    { text: 'Documenting design decisions', goTo: 'notebook' },
  ],
  footprint: 'Tiny',
  stores: 'Your OpModes with status and gamepad mappings. Commits come live from GitHub.',
  settings: z.object({}),
  permissions,
  suggestedPositions: ['Lead Programmer'],
  entities: ['opmode'],
  buckets: [],
  toolLinkSlots: ['code_repo', 'sdk_docs', 'ftc_docs', 'gm0'],
  widgets: [],
  exportTables: ['code_opmodes'],
});
