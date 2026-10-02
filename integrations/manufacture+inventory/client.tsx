import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PackagePlus } from 'lucide-react';
import { Button, toast } from '@teamhub/ui';
import { canWith, friendlyError, useMe, useSupabase, type IntegrationClient } from '@teamhub/sdk';

function AddMade({ job }: { job: { title: string; qty: number; status: string; team_id: string | null } }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const [done, setDone] = useState(false);
  if (job.status !== 'done' || !canWith(me, 'inventory.edit_qty')) return null;
  return (
    <Button
      size="sm"
      icon={<PackagePlus className="size-4" />}
      disabled={done}
      onClick={async () => {
        const match = await sb.from('inv_items').select('id').ilike('name', job.title).limit(1).maybeSingle();
        const res = match.data
          ? await sb.rpc('inv_adjust', { p_item: match.data.id, p_delta: job.qty })
          : await sb.from('inv_items').insert({ name: job.title.slice(0, 160), qty: job.qty, team_id: job.team_id, category: 'Made in-house' });
        if (res.error) return toast.error(friendlyError(res.error));
        setDone(true);
        qc.invalidateQueries({ queryKey: ['inventory'] });
        toast.success('Added to inventory');
      }}
    >
      {done ? 'Added to inventory' : 'Add to inventory'}
    </Button>
  );
}

const client: IntegrationClient = { id: 'manufacture+inventory', slots: { 'manufacture.job.actions': AddMade } };
export default client;
