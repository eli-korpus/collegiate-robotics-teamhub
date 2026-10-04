import { CalendarClock, Flag, Handshake, Megaphone, PartyPopper, Trophy, Wrench } from 'lucide-react';

/** Event kinds: consistent icons and colors everywhere events appear (spec §13.2). */
export const KINDS = {
  practice: { label: 'Practice', color: '#3B82F6', Icon: Wrench },
  meeting: { label: 'Meeting', color: '#8B5CF6', Icon: Megaphone },
  competition: { label: 'Competition', color: '#EF4444', Icon: Trophy },
  outreach: { label: 'Outreach', color: '#10B981', Icon: Handshake },
  deadline: { label: 'Deadline', color: '#F59E0B', Icon: Flag },
  social: { label: 'Social', color: '#EC4899', Icon: PartyPopper },
  other: { label: 'Other', color: '#64748B', Icon: CalendarClock },
} as const;
export type Kind = keyof typeof KINDS;
