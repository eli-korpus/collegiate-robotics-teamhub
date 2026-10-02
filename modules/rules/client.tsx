import { lazy } from 'react';
import { Scale } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:rules', {
  icon: Scale,
  Routes: lazy(() => import('./ui/Routes')),
  quickActions: [{ id: 'ask', label: 'Ask a rule question', icon: Scale, perm: 'rules.post', href: '/rules?new=1', keywords: 'manual rule q&a' }],
  notifications: { 'rules.answered': { text: 'answered your rule question' } },
  entities: {
    item: {
      label: 'Rule',
      icon: Scale,
      fetch: async (sb, id) => {
        const { data } = await sb.from('rule_items').select('id, title').eq('id', id).maybeSingle();
        return data ? { title: data.title, href: '/rules' } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('rule_items').select('id, title, rule_ref').or(`title.ilike.%${q}%,rule_ref.ilike.%${q}%,answer.ilike.%${q}%`).limit(5);
    return (data ?? []).map((r) => ({ id: r.id, title: r.title, subtitle: r.rule_ref ?? undefined, href: '/rules' }));
  },
});
