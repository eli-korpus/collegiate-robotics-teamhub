import { Select, TeamDot, VisibilityNote, cn } from '@teamhub/ui';
import { runtime } from './runtime';
import { canWith, useSession } from './session';
import { isMultiTeam, teamById, useTeams } from './hooks';

// ── Teams ──────────────────────────────────────────────────────────────────
export function TeamBadge({ teamId, className }: { teamId: string | null | undefined; className?: string }) {
  if (!isMultiTeam()) return null;
  const t = teamById(teamId);
  if (!t) return <span className={cn('text-[11.5px] text-faint', className)}>All teams</span>;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11.5px] text-muted', className)}>
      <TeamDot color={`var(--team-${t.shortCode.toLowerCase()}, ${t.color})`} /> {t.name}
    </span>
  );
}

export function TeamScopePicker({
  value,
  onChange,
  perm,
  allowProgram = true,
  label = 'Visible to',
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  perm?: string;
  allowProgram?: boolean;
  label?: string;
}) {
  const teams = useTeams();
  const { me } = useSession();
  if (!isMultiTeam()) return null;
  const allowed = teams.filter((t) => !perm || canWith(me, perm, t.id));
  const programOk = allowProgram && (!perm || me?.isAdmin || teams.every((t) => canWith(me, perm, t.id)) || canWith(me, perm, null));
  return (
    <label className="block space-y-1.5">
      <span className="block text-[13px] font-medium">{label}</span>
      <Select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        {programOk && <option value="">Everyone in {runtime().config.program.name}</option>}
        {allowed.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.number ? ` (${t.number})` : ''} only
          </option>
        ))}
      </Select>
    </label>
  );
}

/** "Visible to everyone on Team A" etc. — derived from the item's team scope (spec §10.8). */
export function ScopeVisibility({ teamId, suffix, locked }: { teamId: string | null | undefined; suffix?: string; locked?: boolean }) {
  const t = teamById(teamId);
  const base = t && isMultiTeam() ? `Visible to everyone on ${t.name}` : `Visible to everyone in ${runtime().config.program.name}`;
  return <VisibilityNote locked={locked}>{suffix ? `${base} ${suffix}` : base}</VisibilityNote>;
}
