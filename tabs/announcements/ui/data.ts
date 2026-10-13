import { useMe, useRows } from '@teamhub/sdk';

export interface Post {
  id: string;
  team_id: string | null;
  title: string;
  body: string;
  image_path: string | null;
  pinned: boolean;
  require_ack: boolean;
  created_by: string | null;
  created_at: string;
  edited_at: string | null;
}

export function usePosts() {
  return useRows<Post>(['announcements', 'posts'], (sb) => sb.from('ann_posts').select('*').order('created_at', { ascending: false }).limit(200));
}

export function useMyAcks() {
  const me = useMe();
  return useRows<{ post_id: string }>(['announcements', 'my-acks'], (sb) => sb.from('ann_acks').select('post_id').eq('user_id', me.id));
}

/** Just what Home's card needs: recent posts' titles and flags, without their text. */
export function usePostHeadlines() {
  return useRows<Pick<Post, 'id' | 'team_id' | 'title' | 'require_ack' | 'created_by' | 'created_at'>>(['announcements', 'headlines'], (sb) =>
    sb.from('ann_posts').select('id, team_id, title, require_ack, created_by, created_at').order('created_at', { ascending: false }).limit(200),
  );
}
