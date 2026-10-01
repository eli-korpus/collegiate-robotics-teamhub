/**
 * Slim Supabase client. Same wiring as supabase-js' createClient, but only Auth + PostgREST load up front;
 * Storage, Edge Functions and Realtime are loaded on first use. Saves ~30 KB gzip from every page load
 * (spec §16.4 bundle budget). Exposes the subset of the SupabaseClient API TeamHub uses.
 */
import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import type { StorageClient } from '@supabase/storage-js';
import type { FunctionsClient } from '@supabase/functions-js';
import type { RealtimeClient } from '@supabase/realtime-js';
import type { Sb } from './types';

type Fetch = typeof fetch;

export function createTeamhubClient(url: string, key: string): Sb {
  const base = new URL(url.endsWith('/') ? url : `${url}/`);
  const storageKey = `sb-${base.hostname.split('.')[0]}-auth-token`;
  const auth = new AuthClient({
    url: new URL('auth/v1', base).href,
    headers: { Authorization: `Bearer ${key}`, apikey: key },
    storageKey,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  });
  const token = async () => (await auth.getSession()).data.session?.access_token ?? null;

  const authedFetch: Fetch = async (input, init) => {
    const t = await token();
    const headers = new Headers(init?.headers);
    if (!headers.has('apikey')) headers.set('apikey', key);
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${t ?? key}`);
    return fetch(input, { ...init, headers });
  };

  const rest = new PostgrestClient(new URL('rest/v1', base).href, { headers: {}, fetch: authedFetch });

  let storage: Promise<StorageClient> | null = null;
  const getStorage = () =>
    (storage ??= import('@supabase/storage-js').then((m) => new m.StorageClient(new URL('storage/v1', base).href, {}, authedFetch)));
  let functions: Promise<FunctionsClient> | null = null;
  const getFunctions = () =>
    (functions ??= import('@supabase/functions-js').then((m) => new m.FunctionsClient(new URL('functions/v1', base).href, { headers: {}, customFetch: authedFetch })));

  // Every storage bucket method is async, so a proxy can await the lazy import transparently.
  const storageFacade = {
    from: (bucket: string) =>
      new Proxy(
        {},
        {
          get: (_t, method: string) =>
            async (...args: unknown[]) => {
              const s = await getStorage();
              const api = s.from(bucket) as any;
              return api[method](...args);
            },
        },
      ),
  };
  const functionsFacade = {
    invoke: async (name: string, opts?: any) => (await getFunctions()).invoke(name, opts),
  };

  const client = {
    auth,
    from: (table: string) => rest.from(table),
    rpc: (fn: string, args?: object, opts?: any) => rest.rpc(fn, args, opts),
    storage: storageFacade,
    functions: functionsFacade,
    /** internal: lazily created realtime connection */
    _realtime: null as Promise<RealtimeClient> | null,
    _realtimeUrl: new URL('realtime/v1', base).href.replace(/^http/, 'ws'),
    _key: key,
  };
  return client as unknown as Sb;
}

/** Lazily connects Realtime (only notifications, check-in, competition day and checklists use it). */
export async function getRealtime(sb: Sb): Promise<RealtimeClient> {
  const c = sb as any;
  if (typeof c.channel === 'function') return c.realtime ?? c; // real supabase-js client (tests/tools)
  c._realtime ??= import('@supabase/realtime-js').then(async (m) => {
    const rt = new m.RealtimeClient(c._realtimeUrl, { params: { apikey: c._key } });
    const set = async () => rt.setAuth((await sb.auth.getSession()).data.session?.access_token ?? null);
    await set();
    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') rt.setAuth(null);
      else rt.setAuth(session?.access_token ?? null);
    });
    return rt;
  });
  return c._realtime;
}
