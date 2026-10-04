import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('polls', {
  create: { label: 'Create polls', default: ['captain', 'mentor'], simple: true },
  vote: { label: 'Answer polls', default: ['member', 'captain', 'mentor'] },
  view_private_results: { label: 'See who answered what on non-public polls', default: ['mentor'] },
});

export default defineModule({
  id: 'polls',
  prefix: 'poll_',
  name: 'Polls & Availability',
  category: 'team',
  icon: 'Vote',
  summary: 'Quick team decisions and “when can everyone meet?” grids.',
  purpose: 'Make a group decision or find a time that works.',
  notFor: [
    { text: 'Collecting personal info (sizes, allergies, contacts)', goTo: 'core:request-info' },
    { text: 'Claiming limited slots', goTo: 'signups' },
    { text: 'Required paperwork', goTo: 'paperwork' },
    { text: 'Announcements', goTo: 'announcements' },
  ],
  footprint: 'Tiny (individual answers are deleted 30 days after a poll closes; totals are kept)',
  stores: 'Polls, answers until 30 days after closing, and the final totals.',
  settings: z.object({}),
  permissions,
  suggestedPositions: [],
  entities: ['poll'],
  buckets: [],
  toolLinkSlots: ['team_chat'],
  widgets: [{ id: 'open', title: 'Open polls', defaultFor: ['member', 'captain', 'mentor'] }],
  exportTables: ['poll_polls', 'poll_votes'],
  seasonRollover: { describe: 'Closes any polls that are still open.', sql: "update poll_polls set closes_at = now() where closes_at is null or closes_at > now();" },
});
