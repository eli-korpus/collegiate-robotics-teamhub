import { lazy } from 'react';
import { GraduationCap } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:skills', {
  icon: GraduationCap,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [{ id: 'next', title: 'Skills you can learn next', component: lazy(() => import('./ui/Widget')) }],
  profileSections: [{ id: 'skills', title: 'Skills', component: lazy(() => import('./ui/ProfileSection')) }],
  quickActions: [{ id: 'new', label: 'Add a skill', icon: GraduationCap, perm: 'skills.manage', href: '/skills?new=1', keywords: 'training certification safety' }],
  entities: {
    skill: {
      label: 'Skill',
      icon: GraduationCap,
      fetch: async (sb, id) => {
        const { data } = await sb.from('skill_skills').select('id, name').eq('id', id).maybeSingle();
        return data ? { title: data.name, href: '/skills' } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('skill_skills').select('id, name, category').ilike('name', `%${q}%`).limit(5);
    return (data ?? []).map((s) => ({ id: s.id, title: s.name, subtitle: s.category ?? 'Skill', href: '/skills' }));
  },
});
