import { Check } from 'lucide-react';
import { cn } from './cn';
import { readableOn } from './color';
import { Field, Input } from './primitives';

/** A person's name as two boxes. Saved as one display name ("First Last"). */
export interface NameParts {
  first: string;
  last: string;
}

/** Splits a saved display name into first and last name (everything after the first word is the last name). */
export function splitName(name: string): NameParts {
  const t = name.trim().replace(/\s+/g, ' ');
  const i = t.indexOf(' ');
  return i < 0 ? { first: t, last: '' } : { first: t.slice(0, i), last: t.slice(i + 1) };
}

/** "First Last", trimmed: the display name that's saved. */
export const joinName = (n: NameParts) => `${n.first.trim()} ${n.last.trim()}`.trim().replace(/\s+/g, ' ');

/** First name and Last name boxes side by side (both required). */
export function NameFields({ value, onChange, autoComplete, className }: { value: NameParts; onChange: (v: NameParts) => void; autoComplete?: boolean; className?: string }) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', className)}>
      <Field label="First name" required>
        {(id) => <Input id={id} required maxLength={40} autoComplete={autoComplete ? 'given-name' : 'off'} value={value.first} onChange={(e) => onChange({ ...value, first: e.target.value })} />}
      </Field>
      <Field label="Last name" required>
        {(id) => <Input id={id} required maxLength={40} autoComplete={autoComplete ? 'family-name' : 'off'} value={value.last} onChange={(e) => onChange({ ...value, last: e.target.value })} />}
      </Field>
    </div>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const PALETTE = ['#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#16A34A', '#0891B2', '#CA8A04', '#4F46E5', '#DC2626', '#0D9488'];
function hashColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function Avatar({ name, src, size = 28, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const bg = hashColor(name);
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold select-none', className)}
      style={{ width: size, height: size, background: src ? undefined : bg, color: readableOn(bg), fontSize: Math.max(10, size * 0.4) }}
      aria-hidden
    >
      {src ? <img src={src} alt="" className="size-full object-cover" loading="lazy" /> : initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = 24 }: { people: { name: string; src?: string | null }[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  return (
    <span className="inline-flex items-center -space-x-1.5" title={people.map((p) => p.name).join(', ')}>
      {shown.map((p, i) => (
        <Avatar key={i} name={p.name} src={p.src} size={size} className="ring-2 ring-surface" />
      ))}
      {people.length > max && (
        <span className="inline-grid place-items-center rounded-full bg-bg-subtle text-[10.5px] font-medium text-muted ring-2 ring-surface" style={{ width: size, height: size }}>
          +{people.length - max}
        </span>
      )}
    </span>
  );
}

export function TeamDot({ color, label, className }: { color: string; label?: string; className?: string }) {
  return <span title={label} aria-label={label} className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: color }} />;
}

export function PositionBadge({ name, kind = 'position' }: { name: string; kind?: 'position' | 'skill' }) {
  return kind === 'skill' ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success-soft px-1.5 py-0.5 text-[11.5px] font-medium text-success"><Check className="size-3" aria-hidden /> {name}</span>
  ) : (
    <span className="inline-flex items-center rounded-md border border-border bg-bg-subtle px-1.5 py-0.5 text-[11.5px] font-medium text-fg">{name}</span>
  );
}

export const TYPE_LABEL = { member: 'Member', captain: 'Captain', mentor: 'Mentor' } as const;
