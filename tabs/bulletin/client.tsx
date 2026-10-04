import { lazy } from 'react';
import { Link2, Pin } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:bulletin', {
  icon: Pin,
  Routes: lazy(() => import('./ui/Routes')),
  quickActions: [{ id: 'add-link', label: 'Add a link to the bulletin board', icon: Link2, perm: 'bulletin.post', href: '/bulletin?new=1', keywords: 'resource url bookmark' }],
  search: async (sb, q) => {
    const { data } = await sb.from('links').select('id, label, url').or(`label.ilike.%${q}%,description.ilike.%${q}%`).limit(5);
    return (data ?? []).map((l) => ({ id: l.id, title: l.label, subtitle: l.url, href: '/bulletin' }));
  },
});
