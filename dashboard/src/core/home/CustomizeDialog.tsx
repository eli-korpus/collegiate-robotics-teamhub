import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button, Checkbox, Dialog, IconButton, toast } from '@teamhub/ui';
import { friendlyError, runtime, useMe, useSupabase } from '@teamhub/sdk';
import type { HomeWidget } from './Home';

/** Home > Customize: show, hide and reorder widgets (loaded only when opened). */
export default function CustomizeDialog({
  open,
  onOpenChange,
  all,
  order,
  hidden,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  all: HomeWidget[];
  order: string[];
  hidden: Set<string>;
}) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const [list, setList] = useState(order);
  const [off, setOff] = useState(hidden);
  const [busy, setBusy] = useState(false);
  const byKey = new Map(all.map((w) => [w.key, w]));
  const moduleName = (k: string) => (k.startsWith('core:') ? 'Home' : runtime().modules.find((m) => k.startsWith(`${m.manifest.id}:`))?.manifest.name ?? '');
  const move = (i: number, d: -1 | 1) => {
    const n = [...list];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    setList(n);
  };
  const save = async (reset = false) => {
    setBusy(true);
    const { error } = await sb.from('profiles').update({ home_prefs: reset ? null : { order: list, hidden: [...off] } }).eq('id', me.id);
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['core', 'me'] });
    onOpenChange(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setList(order);
          setOff(hidden);
        }
        onOpenChange(v);
      }}
      title="Customize Home"
      description="Show, hide and reorder your widgets. This only changes your own Home."
      footer={
        <>
          <Button variant="ghost" onClick={() => save(true)} disabled={busy}>
            Reset to team default
          </Button>
          <Button variant="primary" onClick={() => save()} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <ul className="divide-y divide-border rounded-md border border-border">
        {list
          .filter((k) => byKey.has(k))
          .map((k, i, arr) => (
            <li key={k} className="flex items-center gap-2 px-3 py-2">
              <Checkbox
                checked={!off.has(k)}
                onChange={(v) => {
                  const n = new Set(off);
                  if (v) n.delete(k);
                  else n.add(k);
                  setOff(n);
                }}
                label={
                  <span>
                    {byKey.get(k)!.title} <span className="text-[12px] text-faint">· {moduleName(k)}</span>
                  </span>
                }
              />
              <span className="flex-1" />
              <IconButton label="Move up" size="sm" disabled={i === 0} onClick={() => move(list.indexOf(k), -1)}>
                <ArrowUp className="size-4" />
              </IconButton>
              <IconButton label="Move down" size="sm" disabled={i === arr.length - 1} onClick={() => move(list.indexOf(k), 1)}>
                <ArrowDown className="size-4" />
              </IconButton>
            </li>
          ))}
      </ul>
    </Dialog>
  );
}
