import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { HoverCard } from 'radix-ui';
import { cn } from './cn';
import { readableOn } from './color';

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
    <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success-soft px-1.5 py-0.5 text-[11.5px] font-medium text-success">✓ {name}</span>
  ) : (
    <span className="inline-flex items-center rounded-md border border-border bg-bg-subtle px-1.5 py-0.5 text-[11.5px] font-medium text-fg">{name}</span>
  );
}

export const TYPE_LABEL = { member: 'Member', captain: 'Captain', mentor: 'Mentor' } as const;

export interface PersonChipData {
  name: string;
  avatarUrl?: string | null;
  /** e.g. "Captain · Team A" */
  roles?: { type: keyof typeof TYPE_LABEL; team?: string; teamColor?: string }[];
  positions?: string[];
  isAdmin?: boolean;
  inactive?: boolean;
}

/** One person look everywhere (spec P1). Hovercard shows profile types and positions. */
export function PersonChip({
  person,
  size = 'md',
  showRole,
  href,
  onClick,
  extra,
}: {
  person: PersonChipData;
  size?: 'sm' | 'md';
  showRole?: boolean;
  href?: string;
  onClick?: (e: ReactMouseEvent) => void;
  extra?: ReactNode;
}) {
  const role = person.roles?.[0];
  const chip = (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 align-middle', person.inactive && 'opacity-60')}>
      <Avatar name={person.name} src={person.avatarUrl} size={size === 'sm' ? 20 : 26} />
      <span className={cn('truncate font-medium', size === 'sm' ? 'text-[12.5px]' : 'text-[13.5px]')}>{person.name}</span>
      {showRole && role && <span className="truncate text-[12px] text-muted">{TYPE_LABEL[role.type]}</span>}
      {role?.teamColor && <TeamDot color={role.teamColor} label={role.team} />}
      {extra}
    </span>
  );
  const Trigger = href ? 'a' : onClick ? 'button' : 'span';
  return (
    <HoverCard.Root openDelay={350} closeDelay={80}>
      <HoverCard.Trigger asChild>
        <Trigger href={href} onClick={onClick} className="inline-flex min-w-0 max-w-full rounded-md text-left hover:opacity-90">
          {chip}
        </Trigger>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content sideOffset={6} className="th-anim-pop z-50 w-64 rounded-lg border border-border bg-raised p-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <Avatar name={person.name} src={person.avatarUrl} size={40} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{person.name}</p>
              <p className="truncate text-[12.5px] text-muted">
                {person.roles?.map((r) => `${TYPE_LABEL[r.type]}${r.team ? ` · ${r.team}` : ''}`).join(', ') || 'No team yet'}
                {person.isAdmin && ' · Admin'}
              </p>
            </div>
          </div>
          {!!person.positions?.length && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {person.positions.map((p) => (
                <PositionBadge key={p} name={p} />
              ))}
            </div>
          )}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
