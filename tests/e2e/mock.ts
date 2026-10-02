/**
 * Stubs Supabase for UI smoke tests: a signed-in admin, config-derived reference rows, empty module tables.
 * This verifies every tab renders and degrades gracefully with no data; real DB behavior is covered by PGlite tests.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

const ROOT = join(import.meta.dirname, '..', '..');
const gen = (f: string) => readFileSync(join(ROOT, 'apps', 'dashboard', 'src', 'generated', f), 'utf8');
const json = (src: string) => JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;\s*$/, ''));

export const ME = '99999999-9999-4999-8999-999999999999';

export function loadGenerated() {
  const config = json(gen('config.ts'));
  const schema = json(gen('schema-expectations.ts'));
  return { config, schema };
}

export async function mockSupabase(page: Page, opts: { tables?: Record<string, unknown[]>; rpc?: Record<string, unknown>; role?: 'mentor' | 'member'; admin?: boolean; realFtcScout?: boolean } = {}) {
  const { config, schema } = loadGenerated();
  const base = config.supabase.url as string;
  const ref = new URL(base).hostname.split('.')[0];
  const team = config.teams[0].id;
  const now = new Date().toISOString();
  const user = { id: ME, aud: 'authenticated', role: 'authenticated', email: 'sam@example.com', app_metadata: {}, user_metadata: { name: 'Sam Rivera' }, created_at: now };
  const session = { access_token: 'e2e.e2e.e2e', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'e2e', user };

  const tables: Record<string, unknown[]> = {
    profiles: [{ id: ME, display_name: 'Sam Rivera', avatar_path: null, is_admin: opts.admin ?? true, status: 'active', details: { grade: '11' }, home_prefs: null, created_at: now }],
    memberships: [{ user_id: ME, team_id: team, type: opts.role ?? 'mentor', status: 'active', requested_type: null, note: null, created_at: '2026-09-01T00:00:00Z' }],
    teamhub_settings: [{ id: 1, season_label: config.season, last_keepalive: now, storage_limits: { db_mb: 500, files_mb: 1024 }, storage_history: [], extra_profile_fields: [] }],
    teamhub_modules: [
      { id: 'core', version: schema.core, state: 'active' },
      ...Object.entries(schema.modules).map(([id, version]) => ({ id, version, state: 'active' })),
      ...Object.entries(schema.integrations).map(([id, version]) => ({ id, version, state: 'active' })),
    ],
    links: [{ id: 'l1', label: 'Discord', url: 'https://discord.com', description: null, slot: 'team_chat', section: null, team_id: null, sort: 0, created_by: null }],
    ...opts.tables,
  };
  const rpc: Record<string, unknown> = {
    teamhub_files_nearly_full: false,
    teamhub_storage_usage: { db_bytes: 12_000_000, tables: { profiles: 65536, att_presence: 32768 }, buckets: [], top_files: [], limits: { db_mb: 500, files_mb: 1024 } },
    ...opts.rpc,
  };

  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [`sb-${ref}-auth-token`, JSON.stringify(session)],
  );
  await page.routeWebSocket(/realtime/, () => {});
  await page.route(`${base}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    if (path.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
    if (path.startsWith('/auth/v1/')) return route.fulfill({ json: {} });
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.split('/').pop()!;
      return route.fulfill({ json: fn in rpc ? rpc[fn] : null });
    }
    if (path.startsWith('/rest/v1/')) {
      const table = path.split('/').pop()!;
      const rows = tables[table] ?? [];
      if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `0-0/${rows.length}` }, body: '' });
      if (req.method() !== 'GET') return route.fulfill({ status: 201, json: [] });
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      if (single) return rows.length ? route.fulfill({ json: rows[0] }) : route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'no rows' } });
      return route.fulfill({ json: rows, headers: { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` } });
    }
    return route.fulfill({ json: {} });
  });
  // Avoid flaky third-party requests (favicons, FTCScout) in smoke tests.
  await page.route('https://www.google.com/s2/**', (r) => r.fulfill({ status: 404, body: '' }));
  if (!opts.realFtcScout) await page.route('https://api.ftcscout.org/**', (r) => r.fulfill({ json: { data: { teamByNumber: null, eventByCode: null, eventsSearch: [], __type: { possibleTypes: [] } } } }));
  return { config, schema };
}

/** Collects page errors and console errors (ignoring expected network noise). */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|favicon|406|WebSocket/i.test(t)) return;
    errors.push(`console: ${t}`);
  });
  return errors;
}
