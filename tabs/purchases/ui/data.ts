import { useRows } from '@teamhub/sdk';

export type PStatus = 'requested' | 'ordered' | 'received' | 'declined';

export interface PRequest {
  id: string;
  team_id: string | null;
  item: string;
  url: string | null;
  qty: number;
  est_price: number | null;
  reason: string | null;
  urgency: number;
  status: PStatus;
  requested_by: string | null;
  handled_by: string | null;
  ordered_at: string | null;
  received_at: string | null;
  note: string | null;
  created_at: string;
}

export const useRequests = () => useRows<PRequest>(['purchases', 'list'], (sb) => sb.from('pur_requests').select('*').order('urgency', { ascending: false }).order('created_at', { ascending: false }));
