import { lazy } from 'react';
import { Images } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:media', {
  icon: Images,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [{ id: 'latest', title: 'Latest photos', size: 'md', component: lazy(() => import('./ui/Widget')) }],
  quickActions: [{ id: 'new', label: 'New photo album', icon: Images, perm: 'media.upload', href: '/media?new=1', keywords: 'photos pictures gallery upload' }],
  entities: {
    album: {
      label: 'Album',
      icon: Images,
      fetch: async (sb, id) => {
        const { data } = await sb.from('med_albums').select('id, title').eq('id', id).maybeSingle();
        return data ? { title: data.title, href: `/media/album/${data.id}` } : null;
      },
    },
    item: {
      label: 'Photo',
      icon: Images,
      fetch: async (sb, id) => {
        const { data } = await sb.from('med_items').select('id, album_id, caption').eq('id', id).maybeSingle();
        return data ? { title: data.caption || 'Photo', href: `/media/album/${data.album_id}` } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('med_albums').select('id, title, date').ilike('title', `%${q}%`).limit(5);
    return (data ?? []).map((a) => ({ id: a.id, title: a.title, subtitle: `Album · ${a.date}`, href: `/media/album/${a.id}` }));
  },
});
