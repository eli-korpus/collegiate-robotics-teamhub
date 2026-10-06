import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { HoverCard } from 'radix-ui';
import { cn } from './cn';
import { Avatar, PositionBadge, TeamDot, TYPE_LABEL } from './people';
import { safeHref } from './url';

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
        <Trigger href={safeHref(href)} onClick={onClick} className="inline-flex min-w-0 max-w-full rounded-md text-left hover:opacity-90">
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
