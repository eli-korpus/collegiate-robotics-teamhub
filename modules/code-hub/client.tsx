import { lazy } from 'react';
import { Code2 } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:code-hub', {
  icon: Code2,
  Routes: lazy(() => import('./ui/Routes')),
  entities: {
    opmode: {
      label: 'OpMode',
      icon: Code2,
      fetch: async (sb, id) => {
        const { data } = await sb.from('code_opmodes').select('id, name').eq('id', id).maybeSingle();
        return data ? { title: data.name, href: '/code-hub' } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('code_opmodes').select('id, name, kind').ilike('name', `%${q}%`).limit(5);
    return (data ?? []).map((o) => ({ id: o.id, title: o.name, subtitle: o.kind, href: '/code-hub' }));
  },
});
