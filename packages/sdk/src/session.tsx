import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, runtime } from './runtime';
import type { Me, Membership, PositionHolder, Profile } from './types';

interface SessionCtx {
  session: Session | null;
  /** true until the initial auth check completes */
  loading: boolean;
  me: Me | null;
  meLoading: boolean;
  refreshMe: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionCtx>({
  session: null,
  loading: true,
  me: null,
  meLoading: false,
  refreshMe: () => {},
  signOut: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const sb = getSupabase();
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_OUT') qc.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [sb, qc]);

  const uid = session?.user.id ?? null;
  const meQuery = useQuery({
    queryKey: ['core', 'me', uid],
    enabled: !!uid,
    staleTime: 60_000,
    queryFn: async (): Promise<Me | null> => {
      const [p, m, h] = await Promise.all([
        sb.from('profiles').select('*').eq('id', uid!).maybeSingle(),
        sb.from('memberships').select('*').eq('user_id', uid!),
        sb.from('position_holders').select('*').eq('user_id', uid!),
      ]);
      if (p.error) throw p.error;
      if (!p.data) return null;
      const profile = p.data as Profile;
      return {
        id: uid!,
        email: session?.user.email ?? null,
        profile,
        memberships: (m.data ?? []) as Membership[],
        holders: (h.data ?? []) as PositionHolder[],
        isAdmin: profile.is_admin && profile.status === 'active',
        isActive: profile.status === 'active',
      };
    },
  });

  const value = useMemo<SessionCtx>(
    () => ({
      session,
      loading,
      me: meQuery.data ?? null,
      meLoading: !!uid && meQuery.isLoading,
      refreshMe: () => qc.invalidateQueries({ queryKey: ['core', 'me'] }),
      signOut: async () => {
        await sb.auth.signOut();
      },
    }),
    [session, loading, meQuery.data, meQuery.isLoading, uid, qc, sb],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

/** The signed-in, loaded user. Only use inside the authenticated app shell. */
export function useMe(): Me {
  const { me } = useContext(Ctx);
  if (!me) throw new Error('useMe() used outside the signed-in app');
  return me;
}

/** Client mirror of teamhub_can(): UI gating only; RLS is the real gate (spec §3.4). */
export function canWith(me: Me | null, perm: string, teamId?: string | null): boolean {
  if (!me || !me.isActive) return false;
  if (me.isAdmin) return true;
  const g = runtime().permissions[perm];
  if (!g) return false;
  const typeOk = me.memberships.some(
    (m) => m.status === 'active' && g.types.includes(m.type) && (teamId == null || m.team_id === teamId),
  );
  if (typeOk) return true;
  return me.holders.some(
    (h) => g.positions.includes(h.position_id) && (teamId == null || h.team_id == null || h.team_id === teamId),
  );
}

export function useCan(perm: string, teamId?: string | null): boolean {
  const { me } = useSession();
  return canWith(me, perm, teamId);
}

/** Active team ids of the current user. */
export function myTeamIds(me: Me): string[] {
  return me.memberships.filter((m) => m.status === 'active').map((m) => m.team_id);
}
