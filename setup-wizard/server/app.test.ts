/**
 * Wizard API tests with a fake Supabase: Management API calls are answered by an in-process PGlite database,
 * so "Connect Supabase → apply → create admin → edit → update" runs end to end without network.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
let databaseDown = false;
// Supabase's auth settings (the Management API never returns the SMTP password; neither does this fake).
const authConfig: Record<string, unknown> = { rate_limit_email_sent: 2 };

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
    if (databaseDown) return json({ message: 'connection refused' }, 500);
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
  if (p === `/projects/${REF}/config/auth`) {
    if (method === 'PATCH') Object.assign(authConfig, body);
    return json(authConfig);
  }
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
    const chat = { slot: 'team_chat', label: 'Team chat', url: 'https://chat.example.org/private-invite' };
    const r = await call('POST', '/apply', { config: { ...config(), toolLinks: [chat] } });
    expect(r.status).toBe(200);
    expect(r.body.log.every((l: { ok: boolean }) => l.ok)).toBe(true);
    expect((await db.admin('select id from teamhub_modules order by id')).map((x) => x.id)).toEqual(['attendance', 'attendance+calendar', 'calendar', 'core']);
    expect(calls.some((c) => c.path.includes('functions/deploy'))).toBe(true);
    const auth = calls.find((c) => c.path.endsWith('/config/auth'));
    expect(auth?.body).toMatchObject({ mailer_autoconfirm: true, disable_signup: false });
    const saved = JSON.parse(readFileSync(join(tmp, 'team', 'teamhub.config.json'), 'utf8'));
    expect(saved.modules.attendance.settings.trackHours).toBe(true);
    // Tool links can be private: they go into the database, never into the (public) config file.
    expect(await db.admin('select url from links')).toEqual([{ url: chat.url }]);
    expect(saved.toolLinks).toBeUndefined();
    expect(readFileSync(join(tmp, 'team', 'teamhub.config.json'), 'utf8')).not.toContain('private-invite');
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

  it('reports each step live when the page asks for a checklist', async () => {
    const res = await app.request('/api/apply', {
      method: 'POST',
      body: JSON.stringify({ config: config() }),
      headers: { 'content-type': 'application/json', accept: 'application/x-ndjson', 'x-teamhub-wizard': '1' },
    });
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    const events = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
    const updates = events.filter((e) => e.type === 'steps');
    // The database step is seen running before it is done, and the answer comes last.
    const schema = updates.map((e) => e.steps.find((s: { id: string }) => s.id === 'schema')?.status);
    expect(schema.indexOf('running')).toBeGreaterThan(-1);
    expect(schema.indexOf('running')).toBeLessThan(schema.indexOf('done'));
    const last = updates.at(-1).steps;
    expect(last.map((s: { id: string }) => s.id)).toEqual(expect.arrayContaining(['connect', 'schema', 'join', 'auth', 'check', 'save']));
    expect(last.filter((s: { status: string }) => s.status === 'running' || s.status === 'pending')).toEqual([]);
    expect(events.at(-1)).toMatchObject({ type: 'result', status: 200 });
    expect(events.at(-1).body.log.length).toBeGreaterThan(0);
  });

  it('reports a failure as a failed step and an error line', async () => {
    databaseDown = true;
    const res = await app.request('/api/apply', {
      method: 'POST',
      body: JSON.stringify({ config: config() }),
      headers: { 'content-type': 'application/json', accept: 'application/x-ndjson', 'x-teamhub-wizard': '1' },
    });
    const events = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
    databaseDown = false;
    expect(events.at(-1).type).toBe('error');
    expect(events.at(-1).message).toBeTruthy();
    const steps = events.filter((e) => e.type === 'steps').at(-1).steps;
    expect(steps.find((s: { id: string }) => s.id === 'connect').status).toBe('failed');
  });

  it('discarding an edit puts back the logo files it replaced', async () => {
    const png = (byte: number) => `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, byte]).toString('base64')}`;
    const dir = join(tmp, 'team', 'branding');
    await call('POST', '/branding', { name: 'favicon.png', dataUrl: png(1) });
    await call('POST', '/apply', { config: config() }); // applied: this logo is now the saved one
    await call('POST', '/branding', { name: 'favicon.png', dataUrl: png(2) });
    await call('POST', '/branding', { name: 'team-x.png', dataUrl: png(3) });
    expect(readFileSync(join(dir, 'favicon.png'))[4]).toBe(2);
    await call('DELETE', '/draft');
    expect(readFileSync(join(dir, 'favicon.png'))[4]).toBe(1);
    expect(existsSync(join(dir, 'team-x.png'))).toBe(false);
  });

  it('runs a new-season rollover and records the label', async () => {
    const r = await call('POST', '/season', { label: '2027-28', modules: ['attendance'] });
    expect(r.status).toBe(200);
    expect((await db.admin('select season_label from teamhub_settings'))[0].season_label).toBe('2027–28');
    expect(r.body.backup.path).toContain(tmp);
  });

  it('keeps email confirmation off when the settings turn email on but no email provider is saved', async () => {
    // E.g. a team moving to a new Supabase project with Import: confirmation emails could never be sent.
    const state = await call('GET', '/state');
    const withEmail = { ...state.body.config, features: { ...state.body.config.features, email: true } };
    const applied = await call('POST', '/apply', { config: withEmail });
    expect(applied.status).toBe(200);
    const lastAuth = () => calls.filter((c) => c.method === 'PATCH' && c.path.endsWith('/config/auth')).at(-1);
    expect(lastAuth()?.body).toMatchObject({ mailer_autoconfirm: true });
    expect(applied.body.log.find((l: { step: string }) => l.step === 'Sign-in settings configured').detail).toMatch(/no email provider is saved/);

    const site = await call('POST', '/auth/site-url', { url: 'https://robots.example.org' });
    expect(site.body.note).toMatch(/no email provider is saved/);
    expect(lastAuth()?.body).toMatchObject({ mailer_autoconfirm: true, site_url: 'https://robots.example.org' });

    // Put the settings back for the next test.
    await call('POST', '/apply', { config: state.body.config });
  });

  it('turns email confirmation on only after an email provider (SMTP) is saved in Supabase', async () => {
    expect((await call('GET', '/email')).body).toEqual({ on: false, smtp: null });
    const refused = await call('POST', '/email', { on: true });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toMatch(/email provider first/);

    const provider = { host: 'smtp-relay.brevo.com', port: 587, user: 'abc@smtp-brevo.com', senderEmail: 'robotics@example.org', senderName: 'Example Robotics' };
    expect((await call('POST', '/email/smtp', { ...provider, host: 'https://smtp.example.org' })).status).toBe(400);
    expect((await call('POST', '/email/smtp', provider)).body.error).toMatch(/password/);
    const saved = await call('POST', '/email/smtp', { ...provider, pass: 'xsmtpsib-secret' });
    expect(saved.body.smtp).toEqual(provider);
    expect(authConfig).toMatchObject({ smtp_host: provider.host, smtp_port: '587', smtp_pass: 'xsmtpsib-secret', smtp_admin_email: provider.senderEmail, rate_limit_email_sent: 30 });
    // The password goes to Supabase only: never back to the page, never into the team's files.
    expect(JSON.stringify((await call('GET', '/email')).body)).not.toContain('xsmtpsib-secret');
    expect(readFileSync(join(tmp, 'team', 'teamhub.config.json'), 'utf8')).not.toContain('xsmtpsib-secret');

    // Changing the sender keeps the saved password when it's left blank.
    await call('POST', '/email/smtp', { ...provider, senderName: 'Robots' });
    const patch = calls.filter((c) => c.method === 'PATCH' && c.path.endsWith('/config/auth')).at(-1);
    expect(patch?.body).not.toHaveProperty('smtp_pass');
    expect(authConfig.smtp_sender_name).toBe('Robots');

    await call('POST', '/email', { on: true });
    const last = calls.filter((c) => c.path.endsWith('/config/auth') && c.method === 'PATCH').at(-1);
    expect(last?.body).toMatchObject({ mailer_autoconfirm: false });
    expect((await call('GET', '/email')).body.on).toBe(true);
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

  it('forgets a remembered token once Supabase rejects it (expired), and asks for a new one', async () => {
    await call('POST', '/supabase/token', { pat: 'sbp_test123', remember: true });
    await call('POST', '/supabase/select', { ref: REF, remember: true });
    const credFile = join(tmp, 'home', 'credentials.json');
    expect(readFileSync(credFile, 'utf8')).toContain('sbp_test123');
    // The remembered token expires: Supabase now answers 401 to it.
    const { setCreds } = await import('./credentials');
    setCreds({ pat: 'sbp_expired' }, true);
    const r = await call('GET', '/supabase/projects');
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/expired/);
    const s = await call('GET', '/state');
    expect(s.body.supabase.connected).toBe(false);
    expect(s.body.supabase.projectRef).toBe(REF);
    expect(readFileSync(credFile, 'utf8')).not.toContain('sbp_');
    // Reconnect for anything after this.
    await call('POST', '/supabase/token', { pat: 'sbp_test123', remember: true });
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
