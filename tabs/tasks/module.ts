import { z } from 'zod';
import { defineModule, definePermissions, type PermissionDefs } from '@teamhub/sdk/define';

export const permissions = definePermissions('tasks', {
  create: { label: 'Create tasks', default: ['captain', 'mentor'], simple: true },
  assign: { label: 'Assign tasks to other people', default: ['captain', 'mentor'], simple: true },
  edit_any: { label: "Edit anyone's tasks", default: ['captain', 'mentor'] },
  delete_any: { label: "Delete anyone's tasks", default: ['mentor'] },
});

export const settings = z.object({
  membersCanCreate: z.boolean().default(true).meta({ title: 'Members can create tasks', description: 'They can always update tasks assigned to them.' }),
  labelTodo: z.string().default('To do').meta({ title: 'Column name: to do' }),
  labelDoing: z.string().default('Doing').meta({ title: 'Column name: doing' }),
  labelReview: z.string().default('Review').meta({ title: 'Column name: review' }),
  labelDone: z.string().default('Done').meta({ title: 'Column name: done' }),
});

export default defineModule({
  id: 'tasks',
  prefix: 'task_',
  name: 'Tasks',
  category: 'team',
  icon: 'SquareCheckBig',
  summary: 'Assign and track team work on a board or as a personal list.',
  purpose: 'Assign and track team work.',
  notFor: [
    { text: 'Buying things', goTo: 'purchases' },
    { text: 'Getting a part made', goTo: 'manufacture' },
    { text: 'Logging breakages', goTo: 'repairs' },
    { text: 'Step-by-step lists', goTo: 'checklists' },
  ],
  footprint: '~0.5 MB per season',
  stores: 'Tasks with assignees, subteam, due date and status; comments on tasks.',
  settings,
  permissions,
  dynamicPermissions: (s): PermissionDefs =>
    s.membersCanCreate
      ? { 'tasks.create': { ...permissions['tasks.create'], default: ['member', 'captain', 'mentor'] } }
      : {},
  suggestedPositions: [],
  entities: ['task'],
  buckets: [],
  toolLinkSlots: ['team_chat'],
  widgets: [{ id: 'my-tasks', title: 'Your tasks', defaultFor: ['member', 'captain', 'mentor'] }],
  commentEntities: ['task'],
  refVisibility: { task: 'exists (select 1 from task_items t where t.id::text = {id} and teamhub_in_team(t.team_id))' },
  exportTables: ['task_items'],
});
