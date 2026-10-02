import type { TeamhubConfig } from '@teamhub/config-schema';
import type { NotForEntry, PermissionDefs } from '@teamhub/sdk/define';

export async function api<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: body === undefined ? { 'x-teamhub-wizard': '1' } : { 'content-type': 'application/json', 'x-teamhub-wizard': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export interface CatalogModule {
  id: string;
  name: string;
  category: 'team' | 'engineering' | 'competition' | 'outreach';
  icon: string;
  summary: string;
  purpose: string;
  notFor: NotForEntry[];
  footprint: string;
  stores: string;
  usesFiles: boolean;
  settingsSchema: JsonSchema;
  settingsDefaults: Record<string, unknown>;
  permissions: PermissionDefs;
  suggestedPositions: string[];
  widgets: { id: string; title: string; defaultFor: ('member' | 'captain' | 'mentor')[] }[];
  readme: string;
  version: number;
}

export interface JsonSchema {
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: (string | number)[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  required?: string[];
}

export interface Catalog {
  modules: CatalogModule[];
  integrations: { id: string; requires: string[]; summary: string }[];
  corePermissions: PermissionDefs;
}

export interface GitState {
  isRepo: boolean;
  branch?: string;
  remote?: string | null;
  dirty?: string[];
  userConfigured?: boolean;
  hasUpstream?: boolean;
  gh?: { installed: boolean; authed: boolean; isFork: boolean | null; repo: string | null };
}

export interface ServerState {
  mode: 'setup' | 'existing';
  config: TeamhubConfig | null;
  configInvalid: boolean;
  draft: Draft | null;
  git: GitState;
  supabase: { connected: boolean; projectRef: string | null; remembered: boolean };
  backupRoot: string;
  hostFiles: string[];
}

export interface Draft {
  version: 1;
  flow: 'setup' | 'edit';
  step: number;
  config: TeamhubConfig;
  done: Partial<Record<'applied' | 'admin' | 'published' | 'hosted' | 'keepalive', boolean>>;
  removals: Record<string, 'dormant' | 'delete'>;
  selectedProfileFields?: string[];
}
