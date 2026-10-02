import { lazy } from 'react';
import { BatteryCharging } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:batteries', {
  icon: BatteryCharging,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [{ id: 'needs-charge', title: 'Batteries to charge', priority: 'today', component: lazy(() => import('./widgets/NeedsCharge')) }],
  quickActions: [{ id: 'open', label: 'Log a battery charge', icon: BatteryCharging, perm: 'batteries.log', href: '/batteries', keywords: 'voltage charge' }],
  entities: {
    battery: {
      label: 'Battery',
      icon: BatteryCharging,
      fetch: async (sb, id) => {
        const { data } = await sb.from('bat_batteries').select('id, label').eq('id', id).maybeSingle();
        return data ? { title: `Battery ${data.label}`, href: '/batteries' } : null;
      },
    },
  },
});
