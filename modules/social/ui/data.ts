import { useRows } from '@teamhub/sdk';

export const STAGES = [
  { id: 'idea', label: 'Idea' },
  { id: 'draft', label: 'Draft' },
  { id: 'approval', label: 'Needs approval' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'posted', label: 'Posted' },
] as const;
export type Stage = (typeof STAGES)[number]['id'];

export interface Post {
  id: string;
  team_id: string | null;
  platforms: string[];
  caption: string;
  media_ref: string | null;
  status: Stage;
  scheduled_for: string | null;
  posted_url: string | null;
  created_by: string | null;
  approved_by: string | null;
  updated_at: string;
}
export const usePosts = () => useRows<Post>(['social', 'posts'], (sb) => sb.from('soc_posts').select('*').order('scheduled_for', { nullsFirst: false }).order('updated_at', { ascending: false }));
export const firstLine = (s: string) => s.split('\n')[0].slice(0, 80) || 'Untitled post';
