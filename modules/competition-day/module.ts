import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('competition-day', {
  set_event: { label: 'Choose the active event', default: ['captain', 'mentor'], simple: true },
  edit_pit_notes: { label: 'Edit pit notes', default: ['member', 'captain', 'mentor'] },
});

export default defineModule({
  id: 'competition-day',
  prefix: 'comp_',
  name: 'Competition Day',
  category: 'competition',
  icon: 'Timer',
  summary: 'The live screen at an event: next match, partners, opponents, rankings and pit notes.',
  purpose: 'The live screen at an event.',
  notFor: [
    { text: 'Chat (pit notes are short status text)', goTo: 'link:team_chat' },
    { text: 'Scouting other teams', goTo: 'scouting' },
  ],
  footprint: 'One row per team plus a small history of past events',
  stores: 'Which event each team is at, pit notes, and a history of past events (kept until an admin deletes it).',
  settings: z.object({}),
  permissions,
  suggestedPositions: ['Drive Coach'],
  entities: [],
  buckets: [],
  toolLinkSlots: ['team_chat', 'ftcscout'],
  widgets: [{ id: 'next-match', title: 'Next match', defaultFor: ['member', 'captain', 'mentor'] }],
  exportTables: ['comp_active', 'comp_history'],
});
