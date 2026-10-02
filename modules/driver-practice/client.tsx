import { lazy } from 'react';
import { Gamepad2 } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:driver-practice', {
  icon: Gamepad2,
  Routes: lazy(() => import('./ui/Routes')),
  quickActions: [{ id: 'log', label: 'Log a practice run', icon: Gamepad2, perm: 'driver-practice.log', href: '/driver-practice?new=1', keywords: 'drive score driver' }],
  entities: {
    run: {
      label: 'Practice run',
      icon: Gamepad2,
      fetch: async (sb, id) => {
        const { data } = await sb.from('drv_runs').select('id, date, score').eq('id', id).maybeSingle();
        return data ? { title: `Practice run ${data.date}${data.score != null ? ` (${data.score})` : ''}`, href: '/driver-practice' } : null;
      },
    },
  },
});
