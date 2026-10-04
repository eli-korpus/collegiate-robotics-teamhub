import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('skills', {
  manage: { label: 'Add and edit skills', default: ['mentor'], simple: true },
  sign_off: { label: 'Sign people off on skills', default: ['captain', 'mentor'], positions: ['pos_safety_captain'], simple: true },
});

export default defineModule({
  id: 'skills',
  prefix: 'skill_',
  name: 'Skills & Training',
  category: 'team',
  icon: 'GraduationCap',
  summary: 'Who is trained on what (“Drill press safety”, “Onshape basics”, “Certified driver”) with sign-offs.',
  purpose: 'Record proven abilities with a sign-off.',
  notFor: [
    { text: 'Job titles and responsibilities', goTo: 'core:positions' },
    { text: 'Tracking work', goTo: 'tasks' },
  ],
  footprint: 'Tiny',
  stores: 'The skill list and who signed off whom, when.',
  settings: z.object({}),
  permissions,
  suggestedPositions: ['Safety Captain'],
  entities: ['skill'],
  buckets: [],
  toolLinkSlots: [],
  widgets: [{ id: 'next', title: 'Skills you can learn next', defaultFor: ['member'] }],
  exportTables: ['skill_skills', 'skill_signoffs'],
});
