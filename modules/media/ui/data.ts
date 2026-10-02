import { useRows } from '@teamhub/sdk';

export interface Album {
  id: string;
  team_id: string | null;
  title: string;
  date: string;
  external_url: string | null;
  season: string;
  created_by: string | null;
}
export interface Item {
  id: string;
  album_id: string;
  kind: 'photo' | 'link';
  path: string | null;
  url: string | null;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
}
export const useAlbums = () => useRows<Album>(['media', 'albums'], (sb) => sb.from('med_albums').select('*').order('date', { ascending: false }));
export const useItems = (albumId?: string | null) =>
  useRows<Item>(['media', 'items', albumId ?? 'all'], (sb) => {
    const q = sb.from('med_items').select('*').order('created_at');
    return albumId ? q.eq('album_id', albumId) : q.order('created_at', { ascending: false }).limit(200);
  });

/** YouTube thumbnails are public; anything else shows a generic link card. */
export function videoThumb(url: string): string | null {
  const m = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : null;
}
