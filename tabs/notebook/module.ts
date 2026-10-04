import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('notebook', {
  write: { label: 'Write notebook entries', default: ['member', 'captain', 'mentor'], simple: true },
  edit_any: { label: "Edit anyone's entries", default: ['captain', 'mentor'] },
  manage_subsystems: { label: 'Manage the list of subsystems', default: ['captain', 'mentor'] },
  delete_any: { label: "Delete anyone's entries", default: ['mentor'] },
});

export const settings = z.object({
  tags: z
    .array(z.string())
    .default(['design', 'build', 'programming', 'testing', 'outreach', 'strategy'])
    .meta({ title: 'Tags', description: 'Team-editable. Award names are not built in. Add your own.' }),
  maxPhotos: z.number().int().min(0).max(12).default(6).meta({ title: 'Photos per entry' }),
});

export default defineModule({
  id: 'notebook',
  prefix: 'nb_',
  name: 'Engineering Notebook',
  category: 'engineering',
  icon: 'NotebookPen',
  summary: 'Document engineering work, design iterations and decisions: feeds your portfolio.',
  purpose: 'The single place to document engineering work, design versions and decisions.',
  notFor: [
    { text: 'To-dos', goTo: 'tasks' },
    { text: 'Announcements', goTo: 'announcements' },
    { text: 'Storing CAD or big files', goTo: 'link:cad' },
  ],
  footprint: 'Small text; photos ~150–300 KB each (the main file user)',
  usesFiles: true,
  stores: 'Log entries and design iterations (with decision matrices), subsystems, up to 6 compressed photos per entry.',
  settings,
  permissions,
  suggestedPositions: [],
  entities: ['entry'],
  buckets: [
    { id: 'notebook', public: false, maxFileMB: 0.4, mime: ['image/webp', 'image/jpeg', 'image/png'], uploadPerm: 'notebook.write', deleteAnyPerm: 'notebook.delete_any' },
  ],
  toolLinkSlots: ['portfolio', 'cad', 'drive'],
  widgets: [{ id: 'recent', title: 'Notebook this week', defaultFor: ['captain', 'mentor'] }],
  commentEntities: ['entry'],
  refVisibility: { entry: 'exists (select 1 from nb_entries e where e.id::text = {id} and teamhub_in_team(e.team_id))' },
  exportTables: ['nb_subsystems', 'nb_entries', 'nb_images'],
});
