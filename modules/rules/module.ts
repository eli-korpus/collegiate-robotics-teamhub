import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('rules', {
  post: { label: 'Ask rule questions and add reminders', default: ['member', 'captain', 'mentor'] },
  answer: { label: 'Answer questions and manage entries', default: ['captain', 'mentor'], simple: true },
});

export default defineModule({
  id: 'rules',
  prefix: 'rule_',
  name: 'Rules Reference',
  category: 'competition',
  icon: 'Scale',
  summary: 'Track rule questions, official answers and the rules worth remembering.',
  purpose: 'Track rule questions/clarifications and rules worth remembering.',
  notFor: [
    { text: 'Hosting the game manual', goTo: 'link:manual' },
    { text: 'General Q&A or chat', goTo: 'link:team_chat' },
  ],
  footprint: 'Tiny',
  stores: 'Questions with answers and sources, and short rule reminders, tagged by season.',
  settings: z.object({}),
  permissions,
  suggestedPositions: [],
  entities: ['item'],
  buckets: [],
  toolLinkSlots: ['manual', 'qa_forum'],
  widgets: [],
  exportTables: ['rule_items'],
});
