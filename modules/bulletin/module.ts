import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('bulletin', {
  view: { label: 'See the bulletin board', default: ['member', 'captain', 'mentor'] },
  post: { label: 'Add links to the board', default: ['captain', 'mentor'], simple: true },
  manage: { label: "Edit or remove anyone's links", default: ['mentor'] },
});

export default defineModule({
  id: 'bulletin',
  // No tables of its own: it is the full view of the core `links` table. The prefix names its policies on links.
  prefix: 'bul_',
  name: 'Bulletin Board',
  category: 'team',
  icon: 'Pin',
  summary: "Browse the team's links and resources in one searchable place.",
  purpose: "Browse the team's links and resources.",
  notFor: [
    { text: 'Announcements', goTo: 'announcements' },
    { text: 'Storing files', goTo: 'link:drive' },
    { text: 'Discussion', goTo: 'link:team_chat' },
  ],
  footprint: 'Uses the shared links list: no extra tables',
  stores: 'Nothing new: it shows and organizes the program’s single links list.',
  settings: z.object({}),
  permissions,
  suggestedPositions: [],
  entities: [],
  buckets: [],
  toolLinkSlots: ['drive', 'team_chat'],
  widgets: [],
  exportTables: [],
});
