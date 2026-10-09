import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('signups', {
  create: { label: 'Create sign-up sheets', default: ['captain', 'mentor'], simple: true },
  claim: { label: 'Sign up for slots', default: ['member', 'captain', 'mentor'] },
  manage_claims: { label: 'Add or remove people from any sheet', default: ['captain', 'mentor'] },
});

export default defineModule({
  id: 'signups',
  prefix: 'sign_',
  name: 'Sign-up Sheets',
  category: 'team',
  icon: 'ClipboardPen',
  summary: 'Volunteer slots, snack duty, drivers, pit shifts: first come, first served.',
  purpose: 'Claim one of a limited number of slots.',
  notFor: [
    { text: 'Opinions or availability', goTo: 'polls' },
    { text: 'Collecting info', goTo: 'core:profile-fields' },
    { text: 'Assigning work', goTo: 'tasks' },
  ],
  footprint: 'Tiny',
  stores: 'Sheets, their slots and who claimed each one.',
  settings: z.object({}),
  permissions,
  suggestedPositions: [],
  entities: ['sheet'],
  buckets: [],
  toolLinkSlots: [],
  widgets: [{ id: 'mine', title: 'Your sign-ups', defaultFor: ['member', 'captain', 'mentor'] }],
  exportTables: ['sign_sheets', 'sign_slots', 'sign_claims'],
  seasonRollover: { describe: 'Deletes sign-up sheets from the old season.', sql: 'delete from sign_sheets where season = :old;' },
});
