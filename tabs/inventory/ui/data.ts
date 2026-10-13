import { useRows } from '@teamhub/sdk';

export interface Part {
  id: string;
  team_id: string | null;
  name: string;
  sku: string | null;
  vendor: string | null;
  url: string | null;
  location: string | null;
  qty: number;
  low_at: number | null;
  category: string | null;
  notes: string | null;
}

export const useParts = () => useRows<Part>(['inventory', 'items'], (sb) => sb.from('inv_items').select('*').order('name'));

export const isLow = (p: Part) => p.low_at != null && p.qty <= p.low_at;
