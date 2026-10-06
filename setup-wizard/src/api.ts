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

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';
export interface ProgressStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

/**
 * Like api(), for long actions: the wizard server sends the checklist after every change (one JSON object per line),
 * and `onSteps` gets each version so the page can show which step is running. Resolves with the final answer.
 */
export async function apiProgress<T = any>(path: string, body: unknown, onSteps: (steps: ProgressStep[]) => void): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/x-ndjson', 'x-teamhub-wizard': '1' },
    body: JSON.stringify(body),
  });
  if (!(res.headers.get('content-type') ?? '').includes('ndjson') || !res.body) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
    return data as T;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let answer: { ok: true; body: T } | { ok: false; message: string } | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const e = JSON.parse(line);
      if (e.type === 'steps') onSteps(e.steps);
      else if (e.type === 'result') answer = e.status >= 400 && e.body?.error ? { ok: false, message: e.body.error } : { ok: true, body: e.body };
      else if (e.type === 'error') answer = { ok: false, message: e.message };
    }
    if (done) break;
  }
  if (!answer) throw new Error('The wizard stopped answering before it finished. Check the terminal, then try again.');
  if (!answer.ok) throw new Error(answer.message);
  return answer.body;
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
  maxLength?: number;
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
