/**
 * Supabase Management API client (spec §5.2 step 10). Uses the user's personal access token (PAT), which never
 * leaves this computer. All database changes go through POST /database/query.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const API = 'https://api.supabase.com/v1';

export const TOKEN_REJECTED =
  'Supabase rejected the access token: it has expired or was deleted. Create a new one at supabase.com/dashboard/account/tokens and paste it in wizard home > Connect.';

export class MgmtError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export interface Project {
  id: string;
  ref?: string;
  name: string;
  region: string;
  status: string;
  organization_id?: string;
}

export interface ApiKey {
  name: string;
  api_key: string | null;
  type?: 'legacy' | 'publishable' | 'secret' | null;
}

export type FetchLike = typeof fetch;

export class Mgmt {
  constructor(
    private pat: string,
    private f: FetchLike = fetch,
    /** Called when Supabase rejects the token (expired or deleted), so a dead token isn't kept on this computer. */
    private onUnauthorized?: () => void,
  ) {}

  async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.f(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.pat}`, ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try {
        const j = JSON.parse(text);
        msg = j.message ?? j.error ?? text;
      } catch {}
      if (res.status === 401) {
        this.onUnauthorized?.();
        msg = TOKEN_REJECTED;
      }
      throw new MgmtError(msg || `Supabase API error ${res.status}`, res.status);
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  listProjects() {
    return this.req<Project[]>('/projects');
  }

  async apiKeys(ref: string): Promise<{ publishable: string; secret: string }> {
    const keys = await this.req<ApiKey[]>(`/projects/${ref}/api-keys?reveal=true`);
    const pick = (types: string[], names: string[]) =>
      keys.find((k) => k.type && types.includes(k.type) && k.api_key)?.api_key ?? keys.find((k) => names.includes(k.name) && k.api_key)?.api_key ?? null;
    const publishable = pick(['publishable'], ['anon']);
    const secret = pick(['secret'], ['service_role']);
    if (!publishable || !secret) throw new MgmtError('Could not read the project API keys. Is the project finished setting up?', 400);
    return { publishable, secret };
  }

  /** Runs SQL as the database owner. Returns result rows of the last statement. */
  query<T = Record<string, unknown>>(ref: string, sql: string) {
    return this.req<T[]>(`/projects/${ref}/database/query`, { method: 'POST', body: JSON.stringify({ query: sql }) });
  }

  updateAuthConfig(ref: string, patch: Record<string, unknown>) {
    return this.req(`/projects/${ref}/config/auth`, { method: 'PATCH', body: JSON.stringify(patch) });
  }

  getAuthConfig(ref: string) {
    return this.req<Record<string, unknown>>(`/projects/${ref}/config/auth`);
  }

  setSecrets(ref: string, secrets: { name: string; value: string }[]) {
    return this.req(`/projects/${ref}/secrets`, { method: 'POST', body: JSON.stringify(secrets) });
  }

  /** Deploys every file of database/functions/<slug> (multipart, entrypoint index.ts). */
  async deployFunction(ref: string, slug: string, dir: string, verifyJwt: boolean) {
    const form = new FormData();
    form.append('metadata', JSON.stringify({ name: slug, entrypoint_path: 'index.ts', verify_jwt: verifyJwt }));
    for (const file of walk(dir)) {
      form.append('file', new Blob([readFileSync(file)], { type: 'application/typescript' }), relative(dir, file).split('\\').join('/'));
    }
    return this.req(`/projects/${ref}/functions/deploy?slug=${encodeURIComponent(slug)}`, { method: 'POST', body: form });
  }

  /** Data API (PostgREST) settings: db_schema is the comma-separated list of schemas the API serves. */
  getPostgrest(ref: string) {
    return this.req<{ db_schema?: string | null }>(`/projects/${ref}/postgrest`);
  }

  updatePostgrest(ref: string, patch: { db_schema: string }) {
    return this.req(`/projects/${ref}/postgrest`, { method: 'PATCH', body: JSON.stringify(patch) });
  }

  /** Plain request to the project itself (not the Management API), e.g. the live Data API check. */
  fetchProject(url: string, init: RequestInit) {
    return this.f(url, init);
  }

  health(ref: string) {
    return this.req<{ name: string; status: string }[]>(`/projects/${ref}/health?services=db&services=auth&services=rest&services=storage`);
  }
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

export const projectUrl = (ref: string) => `https://${ref}.supabase.co`;
export const projectRefOf = (p: Project) => p.ref ?? p.id;
