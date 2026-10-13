import { useRows } from '@teamhub/sdk';

export interface Sheet {
  id: string;
  team_id: string | null;
  title: string;
  description: string | null;
  event_ref: string | null;
  closes_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SlotRow {
  id: string;
  sheet_id: string;
  label: string;
  starts_at: string | null;
  capacity: number;
  sort: number;
}

export interface Claim {
  slot_id: string;
  user_id: string;
}

export const isOpen = (s: Sheet) => !s.closes_at || new Date(s.closes_at) > new Date();

export const useSheets = () => useRows<Sheet>(['signups', 'sheets'], (sb) => sb.from('sign_sheets').select('*').order('created_at', { ascending: false }));

export const useSlots = () => useRows<SlotRow>(['signups', 'slots'], (sb) => sb.from('sign_slots').select('*').order('sort'));

export const useClaims = () => useRows<Claim>(['signups', 'claims'], (sb) => sb.from('sign_claims').select('slot_id, user_id'));
