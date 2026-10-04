import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('repairs', {
  report: { label: 'Report breakages and issues', default: ['member', 'captain', 'mentor'] },
  manage: { label: 'Edit, close and delete any issue', default: ['captain', 'mentor'], simple: true },
});

export default defineModule({
  id: 'repairs',
  prefix: 'rep_',
  name: 'Repair & Issue Log',
  category: 'engineering',
  icon: 'Wrench',
  summary: 'Record what broke, why, and how it was fixed.',
  purpose: 'Record what broke, why, and how it was fixed: history and portfolio material.',
  notFor: [{ text: 'Assigning the fix to someone', goTo: 'tasks' }],
  footprint: 'Tiny text; one compressed photo per issue',
  usesFiles: true,
  stores: 'Issues with subsystem, severity, cause, fix and an optional photo.',
  settings: z.object({}),
  permissions,
  suggestedPositions: [],
  entities: ['issue'],
  buckets: [{ id: 'repairs', public: false, maxFileMB: 0.4, mime: ['image/webp', 'image/jpeg', 'image/png'], uploadPerm: 'repairs.report', deleteAnyPerm: 'repairs.manage' }],
  toolLinkSlots: [],
  widgets: [],
  commentEntities: ['issue'],
  refVisibility: { issue: 'exists (select 1 from rep_issues i where i.id::text = {id} and teamhub_in_team(i.team_id))' },
  exportTables: ['rep_issues'],
});
