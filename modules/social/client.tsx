import { lazy } from 'react';
import { Megaphone } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:social', {
  icon: Megaphone,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [{ id: 'queue', title: 'Posts needing attention', priority: 'today', component: lazy(() => import('./ui/Widget')) }],
  quickActions: [{ id: 'new', label: 'Suggest a social post', icon: Megaphone, perm: 'social.draft', href: '/social?new=1', keywords: 'instagram tiktok post caption' }],
  entities: {
    post: {
      label: 'Social post',
      icon: Megaphone,
      fetch: async (sb, id) => {
        const { data } = await sb.from('soc_posts').select('id, caption').eq('id', id).maybeSingle();
        return data ? { title: data.caption.split('\n')[0].slice(0, 80) || 'Post', href: `/social?item=${data.id}` } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('soc_posts').select('id, caption, status').ilike('caption', `%${q}%`).limit(5);
    return (data ?? []).map((p) => ({ id: p.id, title: p.caption.split('\n')[0].slice(0, 80), subtitle: `Social · ${p.status}`, href: `/social?item=${p.id}` }));
  },
});
