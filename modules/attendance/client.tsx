import { lazy } from 'react';
import { QrCode, UserCheck } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:attendance', {
  icon: UserCheck,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [
    { id: 'take-today', title: 'Practice today', priority: 'today', perm: 'attendance.take', component: lazy(() => import('./widgets/TakeToday')) },
    { id: 'my-attendance', title: 'Your attendance', component: lazy(() => import('./widgets/MyAttendance')) },
  ],
  quickActions: [
    { id: 'take', label: 'Take attendance', icon: UserCheck, perm: 'attendance.take', href: '/attendance', keywords: 'practice roster present' },
    { id: 'check-in', label: 'Check in to practice', icon: QrCode, perm: 'attendance.self_check_in', href: '/attendance/check-in', keywords: 'code qr' },
  ],
  profileSections: [{ id: 'attendance', title: 'Attendance', perm: 'attendance.view_all', component: lazy(() => import('./ui/ProfileSection')) }],
  entities: {
    session: {
      label: 'Practice',
      icon: UserCheck,
      fetch: async (sb, id) => {
        const { data } = await sb.from('att_sessions').select('id, title, date').eq('id', id).maybeSingle();
        return data ? { title: `${data.title || 'Practice'} · ${data.date}`, href: `/attendance/session/${data.id}` } : null;
      },
    },
  },
});
