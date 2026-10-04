/**
 * Wizard API tests with a fake Supabase: Management API calls are answered by an in-process PGlite database,
 * so "Connect Supabase → apply → create admin → edit → update" runs end to end without network.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, testConfig, type TestDb } from '../../tools/tests/db/harness';

const tmp = mkdtempSync(join(tmpdir(), 'teamhub-wizard-'));
process.env.TEAMHUB_TEAM_DIR = join(tmp, 'team');
process.env.TEAMHUB_HOME = join(tmp, 'home');
process.env.TEAMHUB_BACKUPS = join(tmp, 'backups');

const REF = 'abcdefghijklmnopqrst';
let db: TestDb;
const calls: { method: string; path: string; body?: unknown }[] = [];
let postgrestSchemas = 'public, graphql_public';

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const method = init?.method ?? 'GET';
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
  calls.push({ method, path: url.pathname, body });
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });
  // The project's own Data API (what the website uses): answers only when the public schema is exposed.
  if (url.hostname === `${REF}.supabase.co` && url.pathname === '/rest/v1/rpc/teamhub_ping') {
    return postgrestSchemas.includes('public') ? json(new Date().toISOString()) : json({ message: 'schema not exposed' }, 404);
  }
  if (init?.headers && (init.headers as Record<string, string>).Authorization !== 'Bearer sbp_test123') return json({ message: 'unauthorized' }, 401);
  const p = url.pathname.replace('/v1', '');
  if (p === '/projects') return json([{ id: REF, name: 'Robotics', region: 'us-east-1', status: 'ACTIVE_HEALTHY' }]);
  if (p === `/projects/${REF}/api-keys`) return json([{ name: 'anon', api_key: 'pub-key', type: 'legacy' }, { name: 'service_role', api_key: 'secret-key', type: 'legacy' }]);
  if (p === `/projects/${REF}/database/query`) {
    try {
      await db.pg.exec('reset role');
      const res = await db.pg.exec(body.query.replace(/create extension if not exists pg_(cron|net)[^;]*;/g, ''));
      return json(res.at(-1)?.rows ?? []);
    } catch (e) {
      await db.pg.exec('rollback').catch(() => {});
      return json({ message: (e as Error).message }, 400);
    }
  }
  if (p.startsWith(`/projects/${REF}/functions/deploy`)) return json({ id: 'fn' }, 201);
  if (p === `/projects/${REF}/secrets`) return json(null, 201);
  if (p === `/projects/${REF}/config/auth`) return json({});
  if (p === `/projects/${REF}/postgrest`) {
    if (method === 'PATCH') postgrestSchemas = body.db_schema;
    return json({ db_schema: postgrestSchemas, max_rows: 1000 });
  }
  return json({ message: `unhandled ${method} ${p}` }, 404);
}

let app: Awaited<ReturnType<typeof import('./app').createApp>>;
const call = async (method: string, path: string, body?: unknown) => {
  const res = await app.request(`/api${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-teamhub-wizard': '1' } });
  return { status: res.status, body: await res.json() };
};

beforeAll(async () => {
  db = await createTestDb();
  // The "cron" schema doesn't exist in PGlite; plans skip it when cron is unavailable in tests.
  await db.pg.exec(`create schema cron; create table cron.job (jobname text); create function cron.schedule(a text, b text, c text) returns int language sql as 'select 1'; create function cron.unschedule(a text) returns boolean language sql as 'select true';`);
  const { createApp } = await import('./app');
  app = createApp({ fetch: fakeFetch as typeof fetch });
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('wizard API', () => {
  it('reports setup mode and serves the catalog with settings schemas', async () => {
    const s = await call('GET', '/state');
    expect(s.body.mode).toBe('setup');
    const cat = await call('GET', '/catalog');
    const att = cat.body.modules.find((m: { id: string }) => m.id === 'attendance');
    expect(att.settingsSchema.properties.trackHours.type).toBe('boolean');
    expect(att.settingsDefaults.trackHours).toBe(false);
  });

  it('rejects bad tokens and lists projects with a good one', async () => {
    expect((await call('POST', '/supabase/token', { pat: 'nope' })).status).toBe(400);
    const r = await call('POST', '/supabase/token', { pat: 'sbp_test123' });
    expect(r.body.projects[0].ref).toBe(REF);
    const sel = await call('POST', '/supabase/select', { ref: REF });
    expect(sel.body).toMatchObject({ url: `https://${REF}.supabase.co`, anonKey: 'pub-key', existingInstall: false });
  });

  const config = () => ({
    ...testConfig({ modules: { attendance: { state: 'active', settings: { trackHours: true } }, calendar: { state: 'active', settings: {} } } }),
    supabase: { url: `https://${REF}.supabase.co`, anonKey: 'pub-key', projectRef: REF },
  });

  it('previews the plan in human terms', async () => {
    const r = await call('POST', '/plan', config());
    expect(r.body.fresh).toBe(true);
    expect(r.body.lines.join(' ')).toMatch(/Create \d+ tables/);
  });

  it('applies a fresh install: schema, functions, secrets, auth config, config file', async () => {
    const r = await call('POST', '/apply', { config: config() });
    expect(r.status).toBe(200);
    expect(r.body.log.every((l: { ok: boolean }) => l.ok)).toBe(true);
    expect((await db.admin('select id from teamhub_modules order by id')).map((x) => x.id)).toEqual(['attendance', 'attendance+calendar', 'calendar', 'core']);
    expect(calls.some((c) => c.path.includes('functions/deploy'))).toBe(true);
    const auth = calls.find((c) => c.path.endsWith('/config/auth'));
    expect(auth?.body).toMatchObject({ mailer_autoconfirm: true, disable_signup: false });
    const saved = JSON.parse(readFileSync(join(tmp, 'team', 'teamhub.config.json'), 'utf8'));
    expect(saved.modules.attendance.settings.trackHours).toBe(true);
    const [secret] = await db.admin(`select value from teamhub_private.config where key = 'cleanup_secret'`);
    expect(secret.value).toHaveLength(48);
  });

  it('diffs an edit and applies a tab removal with a backup first', async () => {
    const next = config();
    delete (next.modules as Record<string, unknown>).calendar;
    const d = await call('POST', '/diff', next);
    expect(d.body.lines.map((l: { text: string }) => l.text)).toEqual(expect.arrayContaining(['Remove tab: Calendar', 'Integration: attendance+calendar']));
    await db.admin(`insert into cal_events (title, starts_at) values ('Kickoff', now())`);
    const r = await call('POST', '/apply', { config: next, backupModules: ['calendar'] });
    expect(r.status).toBe(200);
    expect(r.body.backup.tables.cal_events).toBe(1);
    expect(await db.admin(`select to_regclass('public.cal_events') t`)).toEqual([{ t: null }]);
  });

  it('runs a new-season rollover and records the label', async () => {
    const r = await call('POST', '/season', { label: '2027-28', modules: ['attendance'] });
    expect(r.status).toBe(200);
    expect((await db.admin('select season_label from teamhub_settings'))[0].season_label).toBe('2027–28');
    expect(r.body.backup.path).toContain(tmp);
  });

  it('turns email confirmation on when the team adds SMTP', async () => {
    await call('POST', '/email', { on: true });
    const last = calls.filter((c) => c.path.endsWith('/config/auth')).at(-1);
    expect(last?.body).toMatchObject({ mailer_autoconfirm: false });
  });

  it('detects a Data API that does not serve "public", fixes it, and checks the live API after applying', async () => {
    postgrestSchemas = 'api';
    const sel = await call('POST', '/supabase/select', { ref: REF });
    expect(sel.body.dataApi).toEqual({ schemas: ['api'], ok: false });
    const fixed = await call('POST', '/supabase/data-api/fix', {});
    expect(fixed.body).toEqual({ schemas: ['public', 'api'], ok: true });
    expect(calls.some((c) => c.method === 'PATCH' && c.path.endsWith('/postgrest'))).toBe(true);
    const state = await call('GET', '/state');
    const applied = await call('POST', '/apply', { config: state.body.config });
    expect(applied.body.log.find((l: { step: string }) => l.step.startsWith('Data API check'))).toMatchObject({ ok: true });
    postgrestSchemas = '';
    const off = await call('POST', '/apply', { config: state.body.config });
    expect(off.body.log.find((l: { step: string }) => l.step.startsWith('Data API check'))).toMatchObject({ ok: false });
    postgrestSchemas = 'public, graphql_public';
  });

  it('sees an existing install', async () => {
    const s = await call('GET', '/state');
    expect(s.body.mode).toBe('existing');
    expect(s.body.config.teams[0].id).toBe(TEAM_A);
  });
});

describe('local-only guard', () => {
  it('rejects requests without the wizard header (cross-site forms and fetches)', async () => {
    const res = await app.request('/api/state', { method: 'GET' });
    expect(res.status).toBe(403);
    const post = await app.request('/api/danger/remove', { method: 'POST', body: '{"confirm":"x"}', headers: { 'content-type': 'text/plain' } });
    expect(post.status).toBe(403);
  });
  it('rejects DNS-rebinding hosts and foreign origins', async () => {
    const h = { 'x-teamhub-wizard': '1' };
    expect((await app.request('http://evil.example:4747/api/state', { headers: { ...h, host: 'evil.example:4747' } })).status).toBe(403);
    expect((await app.request('/api/state', { headers: { ...h, origin: 'https://evil.example' } })).status).toBe(403);
    expect((await app.request('/api/state', { headers: { ...h, origin: 'http://localhost:4747' } })).status).toBe(200);
  });
});
