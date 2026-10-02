import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PackagePlus } from 'lucide-react';
import { Button, toast } from '@teamhub/ui';
import { canWith, friendlyError, useMe, useSupabase, type IntegrationClient } from '@teamhub/sdk';

interface Req {
  item: string;
  url: string | null;
  qty: number;
  status: string;
  team_id: string | null;
}

/** Adds received items to inventory: matches an existing part by link or name, else creates one. */
function AddToInventory({ request: r }: { request: Req }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const [done, setDone] = useState(false);
  if (r.status !== 'received' || !canWith(me, 'inventory.edit_qty')) return null;
  return (
    <Button
      size="sm"
      icon={<PackagePlus className="size-4" />}
      disabled={done}
      onClick={async () => {
        const match = r.url
          ? await sb.from('inv_items').select('id').eq('url', r.url).limit(1).maybeSingle()
          : await sb.from('inv_items').select('id').ilike('name', r.item).limit(1).maybeSingle();
        const res = match.data
          ? await sb.rpc('inv_adjust', { p_item: match.data.id, p_delta: r.qty })
          : await sb.from('inv_items').insert({ name: r.item.slice(0, 160), url: r.url, qty: r.qty, team_id: r.team_id });
        if (res.error) return toast.error(friendlyError(res.error));
        setDone(true);
        qc.invalidateQueries({ queryKey: ['inventory'] });
        toast.success(match.data ? `Added ${r.qty} to inventory` : 'New part added to inventory');
      }}
    >
      {done ? 'Added to inventory' : 'Add to inventory'}
    </Button>
  );
}

const client: IntegrationClient = { id: 'purchases+inventory', slots: { 'purchases.request.actions': AddToInventory } };
export default client;
