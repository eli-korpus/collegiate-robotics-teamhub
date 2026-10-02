import { useRows } from '@teamhub/sdk';

export interface MerchItem {
  id: string;
  name: string;
  price: string | null;
  sizes: string[];
}
export interface Drive {
  id: string;
  team_id: string | null;
  title: string;
  description: string | null;
  items: MerchItem[];
  closes_at: string | null;
  status: 'open' | 'closed' | 'delivered';
  created_at: string;
}
export interface Line {
  item: string;
  size: string | null;
  qty: number;
}
export interface Order {
  id: string;
  drive_id: string;
  user_id: string;
  lines: Line[];
  paid: boolean;
  delivered: boolean;
}
export const useDrives = () => useRows<Drive>(['merch', 'drives'], (sb) => sb.from('mer_drives').select('*').order('created_at', { ascending: false }));
/** RLS: members get only their own orders; managers get all. */
export const useOrders = () => useRows<Order>(['merch', 'orders'], (sb) => sb.from('mer_orders').select('*'));
export const isOpen = (d: Drive) => d.status === 'open' && (!d.closes_at || new Date(d.closes_at) > new Date());

/** Quantities per item+size: what to order from the vendor. */
export function tally(drive: Drive, orders: Order[]): { item: MerchItem; size: string | null; qty: number }[] {
  const m = new Map<string, number>();
  for (const o of orders) for (const l of o.lines) m.set(`${l.item}\u0000${l.size ?? ''}`, (m.get(`${l.item}\u0000${l.size ?? ''}`) ?? 0) + l.qty);
  const out: { item: MerchItem; size: string | null; qty: number }[] = [];
  for (const item of drive.items) {
    for (const size of item.sizes.length ? item.sizes : [null]) {
      const qty = m.get(`${item.id}\u0000${size ?? ''}`) ?? 0;
      if (qty) out.push({ item, size, qty });
    }
  }
  return out;
}
