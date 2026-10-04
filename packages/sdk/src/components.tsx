import { Suspense, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Avatar, PersonChip, type PersonChipData } from '@teamhub/ui';
import { runtime, slotComponents } from './runtime';
import { useCan, useSession } from './session';
import { isMultiTeam, usePerson } from './hooks';
import type { PersonInfo } from './types';

// ── People ─────────────────────────────────────────────────────────────────
export function personChipData(p: PersonInfo): PersonChipData {
  const teams = runtime().config.teams;
  const multi = isMultiTeam();
  return {
    name: p.name,
    avatarUrl: p.avatarUrl,
    isAdmin: p.isAdmin,
    inactive: p.status !== 'active',
    positions: p.positions,
    roles: p.memberships
      .filter((m) => m.status === 'active')
      .map((m) => {
        const t = teams.find((x) => x.id === m.team_id);
        return { type: m.type, team: multi ? t?.name : undefined, teamColor: multi ? t?.color : undefined };
      }),
  };
}

/** <PersonChip> for a user id: the one way to show a person (spec P1). */
export function Person({ id, size = 'md', showRole, fallback = 'Someone' }: { id: string | null | undefined; size?: 'sm' | 'md'; showRole?: boolean; fallback?: string }) {
  const p = usePerson(id);
  const nav = useNavigate();
  if (!id) return <span className="text-[13px] text-faint">–</span>;
  if (!p)
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
        <Avatar name={fallback} size={size === 'sm' ? 20 : 26} /> {fallback}
      </span>
    );
  return (
    <PersonChip
      person={personChipData(p)}
      size={size}
      showRole={showRole}
      onClick={(e?: unknown) => {
        (e as Event | undefined)?.stopPropagation?.();
        nav(`/people/${p.id}`);
      }}
    />
  );
}

export function PersonName({ id }: { id: string | null | undefined }) {
  const p = usePerson(id);
  return <>{p?.name ?? 'Someone'}</>;
}

/**
 * Pick one or more people. Options are limited to active people in `teamId` (or everyone when null).
 * `highlightPositions` floats position holders to the top (routing helpers).
 */
/**
 * Pick where an item lives: program-wide (null) or one team. Hidden in single-team programs.
 * Only offers teams where the viewer holds `perm` (if given).
 */
// ── Permissions ────────────────────────────────────────────────────────────
export function PermissionGate({ perm, teamId, children, fallback = null }: { perm: string; teamId?: string | null; children: ReactNode; fallback?: ReactNode }) {
  return useCan(perm, teamId) ? <>{children}</> : <>{fallback}</>;
}

export function AdminOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { me } = useSession();
  return me?.isAdmin ? <>{children}</> : <>{fallback}</>;
}

// ── Slots (integration extension points) ──────────────────────────────────
/** Renders components registered by tabs/integrations for a named slot. Nothing renders when none exist (P2). */
export function Slot<P extends object>({ name, props, wrap }: { name: string; props: P; wrap?: (children: ReactNode) => ReactNode }) {
  const comps = slotComponents(name);
  if (!comps.length) return null;
  const inner = (
    <Suspense fallback={null}>
      {comps.map((C, i) => (
        <C key={i} {...props} />
      ))}
    </Suspense>
  );
  return <>{wrap ? wrap(inner) : inner}</>;
}

export function hasSlot(name: string): boolean {
  return slotComponents(name).length > 0;
}
