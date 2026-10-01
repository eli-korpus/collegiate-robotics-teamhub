import { useState } from 'react';
import { Avatar, Input, Popover, cn, matches, toast } from '@teamhub/ui';
import { useActivePeople, usePeople } from './hooks';
import type { PersonInfo } from './types';

export function PersonPicker({
  value,
  onChange,
  teamId,
  multiple = false,
  max = 5,
  placeholder = 'Choose a person…',
  label,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  teamId?: string | null;
  multiple?: boolean;
  max?: number;
  placeholder?: string;
  label?: string;
}) {
  const people = useActivePeople(teamId);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const all = usePeople();
  const selected = value.map((id) => all.data?.get(id)).filter(Boolean) as PersonInfo[];
  const options = people.filter((p) => !q || matches(p.name, q)).slice(0, 50);
  const toggle = (id: string) => {
    if (!multiple) {
      onChange(value[0] === id ? [] : [id]);
      setOpen(false);
      return;
    }
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else if (value.length < max) onChange([...value, id]);
    else toast.info(`Up to ${max} people`);
  };
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="w-72 p-1.5"
      trigger={
        <button
          type="button"
          aria-label={label ?? placeholder}
          className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-left text-sm shadow-sm"
        >
          {selected.length ? (
            selected.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-bg-subtle py-0.5 pl-0.5 pr-2 text-[12.5px]">
                <Avatar name={p.name} src={p.avatarUrl} size={20} /> {p.name}
              </span>
            ))
          ) : (
            <span className="px-1 text-faint">{placeholder}</span>
          )}
        </button>
      }
    >
      <Input autoFocus placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-1" aria-label="Search people" />
      <ul className="max-h-64 overflow-y-auto">
        {options.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => toggle(p.id)}
              className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13.5px] hover:bg-bg-subtle', value.includes(p.id) && 'bg-accent-soft')}
            >
              <Avatar name={p.name} src={p.avatarUrl} size={22} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.positions[0] && <span className="truncate text-[11.5px] text-faint">{p.positions[0]}</span>}
            </button>
          </li>
        ))}
        {!options.length && <li className="px-2 py-3 text-center text-[12.5px] text-faint">No one found</li>}
      </ul>
      {value.length > 0 && (
        <button type="button" className="mt-1 w-full rounded-md px-2 py-1 text-left text-[12.5px] text-muted hover:bg-bg-subtle" onClick={() => onChange([])}>
          Clear
        </button>
      )}
    </Popover>
  );
}
