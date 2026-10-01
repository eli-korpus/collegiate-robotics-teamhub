import { lazy } from 'react';
import { Megaphone } from 'lucide-react';
import { defineClient, useLastSeen, useMe, useRows } from '@teamhub/sdk';

function useUnreadCount(): number | undefined {
  const me = useMe();
  const [lastSeen] = useLastSeen('announcements');
  const q = useRows<{ created_at: string; created_by: string | null }>(['announcements', 'badge', lastSeen], (sb) =>
    sb.from('ann_posts').select('created_at, created_by').gt('created_at', new Date(lastSeen).toISOString()).limit(50),
  );
  return (q.data ?? []).filter((p) => p.created_by !== me.id).length || undefined;
}

export default defineClient('teamhub-module:announcements', {
  icon: Megaphone,
  Routes: lazy(() => import('./ui/Routes')),
  useBadge: useUnreadCount,
  widgets: [{ id: 'unread', title: 'Unread announcements', priority: 'today', component: lazy(() => import('./widgets/Unread')) }],
  quickActions: [{ id: 'new', label: 'Post an announcement', icon: Megaphone, perm: 'announcements.post', href: '/announcements?new=1', keywords: 'message news' }],
  notifications: { 'announcements.must_read': { text: 'posted an announcement everyone must read' } },
  entities: {
    post: {
      label: 'Announcement',
      icon: Megaphone,
      fetch: async (sb, id) => {
        const { data } = await sb.from('ann_posts').select('id, title').eq('id', id).maybeSingle();
        return data ? { title: data.title, href: `/announcements?item=${data.id}` } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('ann_posts').select('id, title, created_at').or(`title.ilike.%${q}%,body.ilike.%${q}%`).order('created_at', { ascending: false }).limit(5);
    return (data ?? []).map((p) => ({ id: p.id, title: p.title, subtitle: new Date(p.created_at).toLocaleDateString(), href: `/announcements?item=${p.id}` }));
  },
  activity: async (sb, limit) => {
    const { data } = await sb.from('ann_posts').select('id, title, created_by, created_at').order('created_at', { ascending: false }).limit(limit);
    return (data ?? []).map((p) => ({ id: `ann:${p.id}`, at: p.created_at, actor: p.created_by, text: `posted “${p.title}”`, href: `/announcements?item=${p.id}` }));
  },
});
