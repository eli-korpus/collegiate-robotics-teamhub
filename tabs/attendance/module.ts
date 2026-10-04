import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('attendance', {
  take: { label: 'Take attendance & show the check-in code', default: ['captain', 'mentor'], simple: true },
  edit: { label: 'Edit past attendance', default: ['mentor'] },
  view_all: { label: "See everyone's attendance", default: ['captain', 'mentor'], simple: true },
  self_check_in: { label: 'Check themselves in with the code', default: ['member', 'captain', 'mentor'] },
});

export const settings = z.object({
  trackHours: z.boolean().default(false).meta({ title: 'Track hours (check-in and check-out)', description: 'Off = just present/absent. On = also record arrival and leaving times to total hours.' }),
  selfCheckIn: z.boolean().default(true).meta({ title: 'Self check-in with a rotating code', description: 'Members type a 4-digit code (or scan a QR) shown on a screen at practice.' }),
  codeRotateSeconds: z.number().int().min(10).max(300).default(30).meta({ title: 'Code changes every (seconds)' }),
  includeMentors: z.boolean().default(false).meta({ title: 'Track mentors too', description: 'Off = rosters list members and captains only.' }),
});

export default defineModule({
  id: 'attendance',
  prefix: 'att_',
  name: 'Attendance',
  category: 'team',
  icon: 'UserCheck',
  summary: 'Take attendance at practices, with optional self check-in and hours.',
  purpose: 'Record who came to practices.',
  notFor: [
    { text: 'Planning who will come', goTo: 'polls' },
    { text: 'Scheduling practices', goTo: 'calendar' },
  ],
  footprint: '~0.2 MB per season (only presence is stored)',
  stores: 'Practice sessions and who was present (absence is never stored).',
  settings,
  permissions,
  suggestedPositions: [],
  entities: ['session'],
  buckets: [],
  toolLinkSlots: [],
  widgets: [
    { id: 'take-today', title: 'Practice today', defaultFor: ['captain', 'mentor'] },
    { id: 'my-attendance', title: 'Your attendance', defaultFor: ['member', 'captain'] },
  ],
  exportTables: ['att_sessions', 'att_presence'],
  seasonRollover: { describe: 'Old sessions stay for history; nothing is reset.', sql: '' },
});
