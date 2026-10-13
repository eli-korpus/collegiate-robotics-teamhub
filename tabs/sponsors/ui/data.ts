import { useRows } from '@teamhub/sdk';

export const STATUSES = [
  { id: 'prospect', label: 'Prospect', tone: 'neutral' },
  { id: 'asked', label: 'Asked', tone: 'info' },
  { id: 'committed', label: 'Committed', tone: 'success' },
  { id: 'declined', label: 'Declined', tone: 'danger' },
  { id: 'past', label: 'Past', tone: 'neutral' },
] as const;

export type Status = (typeof STATUSES)[number]['id'];

export interface Sponsor {
  id: string;
  team_id: string | null;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  website: string | null;
  status: Status;
  tier: string | null;
  gave: string | null;
  thanked: boolean;
  next_step: string | null;
  next_step_date: string | null;
  owner: string | null;
  notes: string | null;
}

export const useSponsors = (enabled = true) => useRows<Sponsor>(['sponsors', 'list'], (sb) => sb.from('spn_sponsors').select('*').order('name'), { enabled });
