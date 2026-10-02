import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('judging', {
  view: { label: 'See judging prep', default: ['member', 'captain', 'mentor'] },
  manage: { label: 'Edit questions and award evidence', default: ['captain', 'mentor'], simple: true },
});

export default defineModule({
  id: 'judging',
  prefix: 'jdg_',
  name: 'Judging Prep',
  category: 'competition',
  icon: 'Award',
  summary: 'Practice judge interviews and track evidence for each award criterion.',
  purpose: 'Practice interviews and track award evidence.',
  notFor: [
    { text: 'Judging and portfolio checklists', goTo: 'checklists' },
    { text: 'Writing engineering content', goTo: 'notebook' },
  ],
  footprint: 'Tiny',
  stores: 'An interview question bank and award criteria with links to evidence.',
  settings: z.object({}),
  permissions,
  suggestedPositions: [],
  entities: ['criterion'],
  buckets: [],
  toolLinkSlots: ['portfolio', 'manual'],
  widgets: [],
  exportTables: ['jdg_questions', 'jdg_criteria'],
  seasonRollover: { describe: 'Copies award criteria into the new season with empty evidence.', sql: "insert into jdg_criteria (team_id, award, criterion, season, sort) select team_id, award, criterion, :new, sort from jdg_criteria where season = :old;" },
});
