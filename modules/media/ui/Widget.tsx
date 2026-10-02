import { Link } from 'react-router';
import { Images } from 'lucide-react';
import { Card, CardHeader } from '@teamhub/ui';
import { useSignedUrls } from '@teamhub/sdk';
import { useAlbums, useItems } from './data';

export default function LatestPhotos({ teamId }: { teamId: string | null }) {
  const albums = useAlbums();
  const items = useItems();
  const visible = new Set((albums.data ?? []).filter((a) => !teamId || !a.team_id || a.team_id === teamId).map((a) => a.id));
  const photos = (items.data ?? []).filter((i) => i.kind === 'photo' && visible.has(i.album_id)).slice(0, 6);
  const urls = useSignedUrls('media', photos.map((p) => p.path));
  if (!photos.length) return null;
  return (
    <Card>
      <CardHeader icon={<Images className="size-4" />} title="Latest photos" action={<Link to="/media" className="text-[12.5px] text-accent hover:underline">Gallery</Link>} />
      <div className="grid grid-cols-3 gap-1.5 px-4 pb-4">
        {photos.map((p) => (
          <Link key={p.id} to={`/media/album/${p.album_id}`} className="aspect-square overflow-hidden rounded-md bg-bg-subtle">
            {urls.data?.get(p.path!) && <img src={urls.data.get(p.path!)} alt={p.caption ?? ''} loading="lazy" className="size-full object-cover" />}
          </Link>
        ))}
      </div>
    </Card>
  );
}
