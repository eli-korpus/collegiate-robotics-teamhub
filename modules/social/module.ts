import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('social', {
  draft: { label: 'Suggest and draft posts', default: ['member', 'captain', 'mentor'], simple: true },
  approve: { label: 'Approve and schedule posts', default: ['mentor'], positions: ['pos_media_lead'], simple: true },
  mark_posted: { label: 'Mark posts as posted', default: ['captain', 'mentor'] },
});

export default defineModule({
  id: 'social',
  prefix: 'soc_',
  name: 'Social Media Planner',
  category: 'outreach',
  icon: 'Megaphone',
  summary: 'Plan posts from idea to approval to “posted” — nothing is posted automatically.',
  purpose: 'Plan posts from idea to draft, approval, scheduled and posted.',
  notFor: [
    { text: 'Storing photos and videos', goTo: 'media' },
    { text: 'Posting automatically (copy the caption and post it yourself)', goTo: 'link:social' },
  ],
  footprint: 'Tiny (links only, no media)',
  stores: 'Post ideas, captions, links to media and their status.',
  settings: z.object({
    platforms: z.array(z.string().min(1).max(30)).default(['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn']).meta({ title: 'Platforms' }),
  }),
  permissions,
  suggestedPositions: ['Media Lead'],
  entities: ['post'],
  buckets: [],
  toolLinkSlots: ['social'],
  widgets: [{ id: 'queue', title: 'Posts needing attention', defaultFor: ['captain', 'mentor'] }],
  exportTables: ['soc_posts'],
});
