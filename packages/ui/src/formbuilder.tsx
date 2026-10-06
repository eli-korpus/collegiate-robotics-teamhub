/**
 * FormBuilder: team-defined fields for Scouting, Driver Practice metrics and Polls (spec §9.4, P5 season-agnostic).
 * `FieldEditor` builds definitions; `FormRenderer` fills them in (phone-first, big tap targets).
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Minus, Plus, Trash2, Pause, Play, RotateCcw, Star } from 'lucide-react';
import { cn } from './cn';
import { Button, Checkbox, IconButton, Input, Select, Textarea } from './primitives';
import { TagListInput } from './taglist';

export const FIELD_TYPES = {
  counter: 'Counter (+/−)',
  number: 'Number',
  checkbox: 'Yes / No',
  select: 'Pick one',
  multiselect: 'Pick several',
  rating: 'Rating (1–5)',
  text: 'Text',
  timer: 'Timer (seconds)',
} as const;
export type FieldType = keyof typeof FIELD_TYPES;

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  section?: string;
  options?: string[];
  min?: number;
  max?: number;
  help?: string;
}

export type FieldValue = number | boolean | string | string[] | null;
export type FormValues = Record<string, FieldValue>;

const newId = () => `f_${Math.random().toString(36).slice(2, 8)}`;

export function emptyValues(fields: FieldDef[]): FormValues {
  const v: FormValues = {};
  for (const f of fields) {
    v[f.id] = f.type === 'counter' || f.type === 'timer' ? 0 : f.type === 'checkbox' ? false : f.type === 'multiselect' ? [] : null;
  }
  return v;
}

export function FieldEditor({
  fields,
  onChange,
  types = Object.keys(FIELD_TYPES) as FieldType[],
  sections = true,
}: {
  fields: FieldDef[];
  onChange: (f: FieldDef[]) => void;
  types?: FieldType[];
  sections?: boolean;
}) {
  const update = (i: number, patch: Partial<FieldDef>) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...fields];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {fields.map((f, i) => (
        <div key={f.id} className="rounded-md border border-border bg-surface p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_170px_140px_auto]">
            <Input value={f.label} placeholder="Field label" aria-label="Field label" onChange={(e) => update(i, { label: e.target.value })} />
            <Select value={f.type} aria-label="Field type" onChange={(e) => update(i, { type: e.target.value as FieldType })}>
              {types.map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPES[t]}
                </option>
              ))}
            </Select>
            {sections ? (
              <Input value={f.section ?? ''} placeholder="Section (e.g. Auto)" aria-label="Section" onChange={(e) => update(i, { section: e.target.value || undefined })} />
            ) : (
              <span />
            )}
            <div className="flex items-center gap-0.5">
              <IconButton label="Move up" size="sm" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp className="size-4" />
              </IconButton>
              <IconButton label="Move down" size="sm" disabled={i === fields.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown className="size-4" />
              </IconButton>
              <IconButton label="Remove field" size="sm" onClick={() => onChange(fields.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          </div>
          {(f.type === 'select' || f.type === 'multiselect') && (
            <TagListInput className="mt-2" label="Choice" placeholder="Add a choice people can pick" value={f.options ?? []} onChange={(options) => update(i, { options })} />
          )}
          {(f.type === 'number' || f.type === 'counter') && (
            <div className="mt-2 flex gap-2">
              <Input type="number" placeholder="Min" aria-label="Minimum" value={f.min ?? ''} onChange={(e) => update(i, { min: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <Input type="number" placeholder="Max" aria-label="Maximum" value={f.max ?? ''} onChange={(e) => update(i, { max: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </div>
          )}
        </div>
      ))}
      <Button icon={<Plus className="size-4" />} onClick={() => onChange([...fields, { id: newId(), label: '', type: types[0] }])}>
        Add field
      </Button>
    </div>
  );
}

function Counter({ value, onChange, min = 0, max }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Decrease" onClick={() => onChange(Math.max(min, value - 1))} className="grid size-12 place-items-center rounded-lg border border-border bg-surface text-fg active:scale-95">
        <Minus className="size-5" />
      </button>
      <span className="tabular w-12 text-center text-[22px] font-semibold" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label="Increase" onClick={() => onChange(max != null ? Math.min(max, value + 1) : value + 1)} className="grid size-12 place-items-center rounded-lg bg-accent text-accent-fg active:scale-95">
        <Plus className="size-5" />
      </button>
    </div>
  );
}

function Timer({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [running, setRunning] = useState(false);
  const start = useRef(0);
  useEffect(() => {
    if (!running) return;
    start.current = Date.now() - value * 1000;
    const t = setInterval(() => onChange(Math.round((Date.now() - start.current) / 100) / 10), 100);
    return () => clearInterval(t);
     
  }, [running]);
  return (
    <div className="flex items-center gap-2">
      <span className="tabular w-16 text-[20px] font-semibold">{value.toFixed(1)}s</span>
      <Button size="lg" variant={running ? 'secondary' : 'primary'} icon={running ? <Pause className="size-4" /> : <Play className="size-4" />} onClick={() => setRunning(!running)}>
        {running ? 'Stop' : 'Start'}
      </Button>
      <IconButton label="Reset timer" onClick={() => { setRunning(false); onChange(0); }}>
        <RotateCcw className="size-4" />
      </IconButton>
    </div>
  );
}

export function FieldInput({ field: f, value, onChange }: { field: FieldDef; value: FieldValue; onChange: (v: FieldValue) => void }) {
  switch (f.type) {
    case 'counter':
      return <Counter value={Number(value ?? 0)} onChange={onChange} min={f.min ?? 0} max={f.max} />;
    case 'timer':
      return <Timer value={Number(value ?? 0)} onChange={onChange} />;
    case 'number':
      return <Input type="number" inputMode="decimal" min={f.min} max={f.max} value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className="h-11 max-w-40 text-[16px]" aria-label={f.label} />;
    case 'checkbox':
      return <Checkbox size="lg" checked={!!value} onChange={onChange} label={value ? 'Yes' : 'No'} />;
    case 'rating':
      return (
        <div className="flex gap-1" role="radiogroup" aria-label={f.label}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} of 5`} onClick={() => onChange(value === n ? null : n)} className="p-1">
              <Star className={cn('size-8', Number(value ?? 0) >= n ? 'fill-warning text-warning' : 'text-border-strong')} />
            </button>
          ))}
        </div>
      );
    case 'select':
      return (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={f.label}>
          {(f.options ?? []).map((o) => (
            <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(value === o ? null : o)} className={cn('min-h-11 rounded-lg border px-3.5 text-[14px] font-medium', value === o ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface')}>
              {o}
            </button>
          ))}
        </div>
      );
    case 'multiselect': {
      const arr = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-2" aria-label={f.label}>
          {(f.options ?? []).map((o) => {
            const on = arr.includes(o);
            return (
              <button key={o} type="button" aria-pressed={on} onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])} className={cn('min-h-11 rounded-lg border px-3.5 text-[14px] font-medium', on ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface')}>
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    case 'text':
      return <Textarea rows={2} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} aria-label={f.label} />;
  }
}

/** Renders fields grouped by section. */
export function FormRenderer({ fields, values, onChange }: { fields: FieldDef[]; values: FormValues; onChange: (v: FormValues) => void }) {
  const sections: { name: string; fields: FieldDef[] }[] = [];
  for (const f of fields) {
    const name = f.section ?? '';
    let s = sections.find((x) => x.name === name);
    if (!s) sections.push((s = { name, fields: [] }));
    s.fields.push(f);
  }
  return (
    <div className="space-y-5">
      {sections.map((s) => (
        <section key={s.name || '_'} className="space-y-3">
          {s.name && <h3 className="border-b border-border pb-1 text-[12px] font-semibold uppercase tracking-wider text-faint">{s.name}</h3>}
          {s.fields.map((f) => (
            <div key={f.id} className="space-y-1.5">
              <p className="text-[14px] font-medium">{f.label || 'Untitled field'}</p>
              {f.help && <p className="text-[12px] text-muted">{f.help}</p>}
              <FieldInput field={f} value={values[f.id] ?? null} onChange={(v) => onChange({ ...values, [f.id]: v })} />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/** Aggregate one field across many entries: numbers → average, yes/no → %, choice → most common. */
export function summarizeField(f: FieldDef, values: FieldValue[]): string {
  const vals = values.filter((v) => v != null && v !== '');
  if (!vals.length) return '–';
  switch (f.type) {
    case 'counter':
    case 'number':
    case 'rating':
    case 'timer': {
      const nums = vals.map(Number).filter((n) => !Number.isNaN(n));
      const avg = nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
      return avg.toFixed(avg < 10 ? 1 : 0);
    }
    case 'checkbox':
      return `${Math.round((vals.filter(Boolean).length / vals.length) * 100)}%`;
    case 'select':
    case 'multiselect': {
      const counts = new Map<string, number>();
      for (const v of vals.flatMap((x) => (Array.isArray(x) ? x : [x as string]))) counts.set(v, (counts.get(v) ?? 0) + 1);
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      return top ? `${top[0]} (${top[1]})` : '–';
    }
    case 'text':
      return `${vals.length} note${vals.length === 1 ? '' : 's'}`;
  }
}

export function numericAverage(values: FieldValue[]): number | null {
  const nums = values.filter((v) => typeof v === 'number') as number[];
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}
