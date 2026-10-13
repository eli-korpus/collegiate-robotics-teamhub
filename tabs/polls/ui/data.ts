import { useMe, useRows } from '@teamhub/sdk';

export type Visibility = 'public' | 'results' | 'private';

export type Kind = 'choice' | 'availability' | 'text';

export interface AvailOptions {
  dates: string[];
  slots: string[];
}

export interface Poll {
  id: string;
  team_id: string | null;
  kind: Kind;
  question: string;
  options: string[] | AvailOptions;
  multi: boolean;
  visibility: Visibility;
  closes_at: string | null;
  result: Totals | null;
  ref: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Totals {
  counts: number[];
  voters: number;
}

export interface VoteRow {
  poll_id: string;
  user_id: string;
  value: number[] | string;
}

export const isOpen = (p: Poll) => !p.closes_at || new Date(p.closes_at) > new Date();

export const usePolls = () => useRows<Poll>(['polls', 'list'], (sb) => sb.from('poll_polls').select('*').order('created_at', { ascending: false }));

export const useMyVotes = () => {
  const me = useMe();
  return useRows<VoteRow>(['polls', 'mine'], (sb) => sb.from('poll_votes').select('*').eq('user_id', me.id));
};
