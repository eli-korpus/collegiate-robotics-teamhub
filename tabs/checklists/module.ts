import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('checklists', {
  run: { label: 'Run checklists (tick items)', default: ['member', 'captain', 'mentor'] },
  manage_lists: { label: 'Create and edit checklists', default: ['captain', 'mentor'], simple: true },
});

export default defineModule({
  id: 'checklists',
  prefix: 'chk_',
  name: 'Checklists',
  category: 'competition',
  icon: 'ListChecks',
  summary: 'Pre-match, pit, packing, inspection, judging and portfolio checklists. Run again and again.',
  purpose: 'Run through a list of steps, again and again.',
  notFor: [
    { text: 'Assigning work to people', goTo: 'tasks' },
    { text: 'Interview practice', goTo: 'judging' },
  ],
  footprint: 'Tiny (old runs are pruned after 30 days)',
  stores: 'Checklists with sections and items, and recent runs (who ticked what).',
  settings: z.object({}),
  permissions,
  suggestedPositions: ['Safety Captain'],
  entities: ['list'],
  buckets: [],
  toolLinkSlots: ['manual'],
  widgets: [],
  exportTables: ['chk_lists', 'chk_runs'],
  seasonRollover: { describe: 'Clears all checklist run history.', sql: 'delete from chk_runs;' },
});
