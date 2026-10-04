import { Link } from 'react-router';
import { BatteryWarning } from 'lucide-react';
import { Card, CardHeader } from '@teamhub/ui';
import { batteryStatus, useBatLogs, useBatSettings, useBatteries } from '../ui/data';

/** "3 batteries need charging". */
export default function NeedsCharge({ teamId }: { teamId: string | null }) {
  const b = useBatteries();
  const logs = useBatLogs();
  const s = useBatSettings();
  const list = (b.data ?? []).filter((x) => !teamId || !x.team_id || x.team_id === teamId).map((x) => ({ x, st: batteryStatus(x, logs.data ?? [], s) }));
  const need = list.filter((r) => r.st.state === 'needs_charge' || r.st.state === 'unknown');
  const weak = list.filter((r) => r.st.state === 'weak');
  if (!need.length && !weak.length) return null;
  return (
    <Card>
      <CardHeader icon={<BatteryWarning className="size-4" />} title={need.length ? `${need.length} batter${need.length === 1 ? 'y needs' : 'ies need'} charging` : `${weak.length} weak batter${weak.length === 1 ? 'y' : 'ies'}`} action={<Link to="/batteries" className="text-[12px] font-medium text-accent">Open</Link>} />
      <p className="px-4 pb-4 text-[13px] text-muted">{[...need, ...weak].map((r) => r.x.label).join(', ')}</p>
    </Card>
  );
}
