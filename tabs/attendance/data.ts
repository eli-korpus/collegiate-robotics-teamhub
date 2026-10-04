import { useQuery } from '@tanstack/react-query';
import { useModuleSettings, useSeason, useSupabase, type PersonInfo } from '@teamhub/sdk';
import { toDateInput } from '@teamhub/ui';

export interface Session {
  id: string;
  team_id: string | null;
  date: string;
  starts_at: string | null;
  ends_at: string | null;
  title: string | null;
  season: string;
  closed: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Presence {
  session_id: string;
  user_id: string;
  check_in: string | null;
  check_out: string | null;
}

export interface AttSettings {
  trackHours: boolean;
  selfCheckIn: boolean;
  codeRotateSeconds: number;
  includeMentors: boolean;
}

export const useAttSettings = () => useModuleSettings<AttSettings>('attendance');

export function sessionTitle(s: Pick<Session, 'title'>): string {
  return s.title || 'Practice';
}

/** All sessions of the current season visible to the viewer. */
export function useSeasonSessions() {
  const sb = useSupabase();
  const season = useSeason();
  return useQuery({
    queryKey: ['attendance', 'sessions', season],
    queryFn: async () => {
      const { data, error } = await sb.from('att_sessions').select('*').eq('season', season).order('date', { ascending: false });
      if (error) throw error;
      return data as Session[];
    },
  });
}

/** Presence rows visible to the viewer for the given sessions (own rows only for regular members). */
export function usePresence(sessionIds: string[] | undefined, userId?: string) {
  const sb = useSupabase();
  return useQuery({
    queryKey: ['attendance', 'presence', userId ?? 'all', sessionIds?.length ?? 0, sessionIds?.[0]],
    enabled: !!sessionIds,
    queryFn: async () => {
      if (!sessionIds?.length) return [] as Presence[];
      const out: Presence[] = [];
      for (let i = 0; i < sessionIds.length; i += 200) {
        let q = sb.from('att_presence').select('*').in('session_id', sessionIds.slice(i, i + 200));
        if (userId) q = q.eq('user_id', userId);
        const { data, error } = await q;
        if (error) throw error;
        out.push(...(data as Presence[]));
      }
      return out;
    },
  });
}

/** Should this person be on this session's roster? (active membership of an allowed type, joined before the session) */
export function expectedAt(p: PersonInfo, s: Session, includeMentors: boolean): boolean {
  if (p.status !== 'active') return false;
  return p.memberships.some(
    (m) =>
      m.status === 'active' &&
      (includeMentors || m.type !== 'mentor') &&
      (s.team_id == null || m.team_id === s.team_id) &&
      (!m.created_at || m.created_at.slice(0, 10) <= s.date),
  );
}

export function roster(people: PersonInfo[], s: Session, includeMentors: boolean): PersonInfo[] {
  return people.filter((p) => expectedAt(p, s, includeMentors)).sort((a, b) => a.name.localeCompare(b.name));
}

export interface Stats {
  attended: number;
  expected: number;
  pct: number | null;
  hoursMs: number;
}

/** Attendance % = sessions attended / sessions this person was expected at (past and today only). */
export function statsFor(p: PersonInfo, sessions: Session[], presence: Presence[], includeMentors: boolean): Stats {
  const today = toDateInput(new Date());
  const mine = new Map(presence.filter((x) => x.user_id === p.id).map((x) => [x.session_id, x]));
  let expected = 0;
  let attended = 0;
  let hoursMs = 0;
  for (const s of sessions) {
    if (s.date > today) continue;
    const pr = mine.get(s.id);
    if (!expectedAt(p, s, includeMentors) && !pr) continue;
    expected++;
    if (pr) {
      attended++;
      if (pr.check_in && pr.check_out) hoursMs += new Date(pr.check_out).getTime() - new Date(pr.check_in).getTime();
    }
  }
  return { attended, expected, pct: expected ? attended / expected : null, hoursMs };
}

export function hours(ms: number): string {
  return (ms / 3_600_000).toFixed(1);
}
