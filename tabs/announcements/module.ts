import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('announcements', {
  post: { label: 'Post announcements', default: ['captain', 'mentor'], simple: true },
  view_acks: { label: 'See who has read “must read” posts', default: ['captain', 'mentor'] },
  delete_any: { label: "Edit or delete anyone's announcements", default: ['mentor'] },
});

export default defineModule({
  id: 'announcements',
  prefix: 'ann_',
  name: 'Announcements',
  category: 'team',
  icon: 'Megaphone',
  summary: 'One-way messages to the team, with optional “I’ve read this”.',
  purpose: 'One-way messages to the team.',
  notFor: [
    { text: 'Discussion (there are no replies)', goTo: 'link:team_chat' },
    { text: 'Questions that need answers', goTo: 'polls' },
    { text: 'Collecting personal info', goTo: 'core:profile-fields' },
    { text: 'A library of links', goTo: 'core:links' },
  ],
  footprint: 'Tiny text; one optional compressed image per post',
  usesFiles: true,
  stores: 'Posts, an optional image each, and read receipts only for “must read” posts.',
  settings: z.object({}),
  permissions,
  suggestedPositions: [],
  entities: ['post'],
  buckets: [
    {
      id: 'announcements',
      public: false,
      maxFileMB: 0.4,
      mime: ['image/webp', 'image/jpeg', 'image/png'],
      uploadPerm: 'announcements.post',
      deleteAnyPerm: 'announcements.delete_any',
    },
  ],
  toolLinkSlots: ['team_chat'],
  widgets: [{ id: 'unread', title: 'Unread announcements', defaultFor: ['member', 'captain', 'mentor'] }],
  exportTables: ['ann_posts', 'ann_acks'],
});
