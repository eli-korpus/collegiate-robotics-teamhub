import { useRows, type PersonInfo } from '@teamhub/sdk';

export interface Item {
  id: string;
  team_id: string | null;
  name: string;
  url: string | null;
  due: string | null;
  season: string;
  applies_to: 'members' | 'everyone';
}

export interface Done {
  item_id: string;
  user_id: string;
  done_at: string;
}

export const useItems = (season: string) => useRows<Item>(['paperwork', 'items', season], (sb) => sb.from('ppr_items').select('*').eq('season', season).order('due', { nullsFirst: false }));

export const useDone = () => useRows<Done>(['paperwork', 'done'], (sb) => sb.from('ppr_done').select('item_id, user_id, done_at'));

export function appliesTo(p: PersonInfo, i: Item): boolean {
  return p.memberships.some((m) => m.status === 'active' && (i.team_id == null || m.team_id === i.team_id) && (i.applies_to === 'everyone' || m.type !== 'mentor'));
}
