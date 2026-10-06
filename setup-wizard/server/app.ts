import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { parseConfig, type TeamhubConfig } from '@teamhub/config-schema';
import { isValidRepoName } from '@teamhub/config-schema/util';
import {
  configPath,
  describePlan,
  diffConfigs,
  generate,
  loadCatalog,
  planToSql,
  REPO_ROOT,
  resolveConfig,
  teamDir,
  themeCss,
  type Catalog,
} from '@teamhub/generator';
import { allCorePermissions, modulePermissions } from '@teamhub/sdk/define';
import { forgetCreds, getCreds, rememberedOnDisk, setCreds } from './credentials';
import { Mgmt, MgmtError, projectRefOf, projectUrl, type FetchLike } from './mgmt';
import { gitStatus, publish, sh, useNoreplyEmail } from './git';
import { checkForUpdate, installDependencies, mergeRelease, readState, revertUpdate, writeState } from './update';
import { checkSite, existingHostPaths, hostFiles, keepaliveFile, updatesWorkflowFile, writeHostFiles } from './hosting';
import { BACKUP_ROOT, exportData, importData } from './backup';
import { respondWithProgress, withStatus, type Progress } from './progress';
import { applyConfig, computePlan, configureAuth, createAdmin, dataApiStatus, exposePublicSchema, newSeason, readDbState, removeEverything } from './provision';

/** Hostnames the wizard answers to. Anything else is a DNS-rebinding attempt (a website pointing its own domain at 127.0.0.1). */
export const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
export const isLocalHost = (host: string | undefined | null) => !!host && LOCAL_HOSTS.has(host.replace(/:\d+$/, '').toLowerCase());
/** Header the wizard UI sends on every call. A cross-site page can't add it without a CORS preflight, which we never allow. */
export const WIZARD_HEADER = 'x-teamhub-wizard';

/**
 * The wizard holds your Supabase access token and can change your database and push to GitHub, so only its own page
 * may call it: the Host must be local, any Origin must be local, and every request must carry the wizard header.
 */
const localOnly: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header('origin');
  if (!isLocalHost(c.req.header('host') ?? new URL(c.req.url).host)) return c.json({ error: 'Forbidden host' }, 403);
  if (origin && !isLocalHost(new URL(origin).host)) return c.json({ error: 'Forbidden origin' }, 403);
  if (c.req.header(WIZARD_HEADER) !== '1') return c.json({ error: 'Missing wizard header' }, 403);
  await next();
};

const DRAFT = () => join(teamDir(), '.wizard-draft.json');

export interface AppDeps {
  fetch?: FetchLike;
  root?: string;
  /** Restarts the wizard process (after an update installs new code). Provided by main.ts. */
  onRestart?: () => void;
}

export function createApp(deps: AppDeps = {}) {
  const app = new Hono().basePath('/api');
  app.use('*', localOnly);
  const catalogP = loadCatalog(deps.root);
  const mgmt = () => {
    const pat = getCreds().pat;
    if (!pat) throw new MgmtError('Connect your Supabase account first (step “Connect Supabase”).', 400);
    return new Mgmt(pat, deps.fetch);
  };
  const projectRef = (c?: TeamhubConfig | null) => {
    const ref = getCreds().projectRef ?? c?.supabase.projectRef;
    if (!ref) throw new MgmtError('Pick your Supabase project first.', 400);
    return ref;
  };
  const readConfig = (): TeamhubConfig | null => {
    if (!existsSync(configPath())) return null;
    const r = parseConfig(JSON.parse(readFileSync(configPath(), 'utf8')));
    return r.ok ? r.config : null;
  };
  const parseOr400 = (raw: unknown) => {
    const r = parseConfig(raw);
    if (!r.ok) throw new MgmtError(r.issues.map((i) => `${i.path}: ${i.message}`).join('\n'), 400);
    return r.config;
  };

  app.onError((err, c) => {
    const status = err instanceof MgmtError ? err.status : 500;
    console.error(`[wizard] ${err.message}`);
    return c.json({ error: err.message }, status >= 400 && status < 600 ? (status as 400) : 500);
  });

  // ── State & catalog ──────────────────────────────────────────────────────
  app.get('/state', async (c) => {
    const config = readConfig();
    const draft = existsSync(DRAFT()) ? JSON.parse(readFileSync(DRAFT(), 'utf8')) : null;
    const creds = getCreds();
    return c.json({
      mode: config ? 'existing' : 'setup',
      config,
      configInvalid: existsSync(configPath()) && !config,
      draft,
      git: await gitStatus(),
      supabase: { connected: !!creds.pat, projectRef: creds.projectRef ?? config?.supabase.projectRef ?? null, remembered: rememberedOnDisk() },
      backupRoot: BACKUP_ROOT,
      hostFiles: existingHostPaths(),
    });
  });

  app.get('/catalog', async (c) => {
    const cat = await catalogP;
    const modules = [...cat.modules.values()].map(({ manifest: m, readme, version }) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      icon: m.icon,
      summary: m.summary,
      purpose: m.purpose,
      notFor: m.notFor,
      footprint: m.footprint,
      stores: m.stores,
      usesFiles: !!m.usesFiles,
      settingsSchema: z.toJSONSchema(m.settings, { io: 'input', unrepresentable: 'any' }),
      settingsDefaults: m.settings.parse({}),
      permissions: m.permissions,
      suggestedPositions: m.suggestedPositions,
      widgets: m.widgets,
      readme,
      version,
      hasDynamicPermissions: !!m.dynamicPermissions,
    }));
    const integrations = [...cat.integrations.values()].map((i) => ({ id: i.manifest.id, requires: i.manifest.requires, summary: i.manifest.summary }));
    return c.json({ modules, integrations, corePermissions: allCorePermissions });
  });

  /** Permission definitions for a config (includes settings-dependent ones like To Manufacture methods). */
  app.post('/permissions', async (c) => {
    const cat = await catalogP;
    const body = await c.req.json();
    const r = parseConfig(body);
    const config = r.ok ? r.config : null;
    const defs = { ...allCorePermissions };
    for (const [id, entry] of Object.entries((body?.modules ?? {}) as Record<string, { settings?: unknown }>)) {
      const cm = cat.modules.get(id);
      if (!cm) continue;
      const settings = cm.manifest.settings.safeParse(entry.settings ?? {});
      Object.assign(defs, modulePermissions(cm.manifest, settings.success ? settings.data : cm.manifest.settings.parse({}), config ?? (body as TeamhubConfig)));
    }
    return c.json(defs);
  });

  // ── Draft (autosave so people can quit and resume) ──────────────────────
  app.put('/draft', async (c) => {
    mkdirSync(teamDir(), { recursive: true });
    writeFileSync(DRAFT(), JSON.stringify(await c.req.json(), null, 2));
    return c.json({ ok: true });
  });
  app.delete('/draft', (c) => {
    rmSync(DRAFT(), { force: true });
    return c.json({ ok: true });
  });

  // ── Validation, diff, plan ───────────────────────────────────────────────
  app.post('/validate', async (c) => {
    const raw = await c.req.json();
    const r = parseConfig(raw);
    if (!r.ok) return c.json({ ok: false, issues: r.issues });
    const resolved = resolveConfig(r.config, await catalogP);
    return c.json({ ok: resolved.errors.length === 0, issues: resolved.errors.map((message) => ({ path: '', message })), themeNotes: themeCss(resolved).adjusted });
  });

  app.post('/diff', async (c) => {
    const next = parseOr400(await c.req.json());
    const cur = readConfig();
    if (!cur) return c.json({ lines: [] });
    return c.json({ lines: diffConfigs(cur, next, await catalogP) });
  });

  app.post('/plan', async (c) => {
    const config = parseOr400(await c.req.json());
    const cat = await catalogP;
    let db = null;
    try {
      db = await readDbState(mgmt(), projectRef(config));
    } catch {}
    const plan = computePlan(cat, config, db);
    return c.json({ summary: plan.summary, lines: describePlan(plan), sql: planToSql(plan), fresh: !db, bucketsToDelete: plan.bucketsToDelete });
  });

  // ── Supabase ─────────────────────────────────────────────────────────────
  app.post('/supabase/token', async (c) => {
    const { pat, remember } = await c.req.json<{ pat: string; remember?: boolean }>();
    if (!/^sbp_[A-Za-z0-9]+$/.test(pat?.trim() ?? '')) throw new MgmtError('That doesn’t look like a Supabase access token (it starts with sbp_).', 400);
    const projects = await new Mgmt(pat.trim(), deps.fetch).listProjects();
    setCreds({ pat: pat.trim() }, !!remember);
    return c.json({ projects: projects.map((p) => ({ ref: projectRefOf(p), name: p.name, region: p.region, status: p.status })) });
  });
  app.post('/supabase/forget', (c) => {
    forgetCreds();
    return c.json({ ok: true });
  });
  app.get('/supabase/projects', async (c) => {
    const projects = await mgmt().listProjects();
    return c.json({ projects: projects.map((p) => ({ ref: projectRefOf(p), name: p.name, region: p.region, status: p.status })) });
  });
  app.post('/supabase/select', async (c) => {
    const { ref, remember } = await c.req.json<{ ref: string; remember?: boolean }>();
    const keys = await mgmt().apiKeys(ref);
    setCreds({ projectRef: ref }, !!remember || rememberedOnDisk());
    const db = await readDbState(mgmt(), ref).catch(() => null);
    const dataApi = await dataApiStatus(mgmt(), ref).catch(() => null);
    return c.json({ url: projectUrl(ref), anonKey: keys.publishable, projectRef: ref, existingInstall: !!db, versions: db?.versions ?? null, dataApi });
  });
  // Turn on the Data API for the public schema (new Supabase projects can be created with it off or pointed elsewhere).
  app.post('/supabase/data-api/fix', async (c) => c.json(await exposePublicSchema(mgmt(), projectRef(readConfig()))));
  app.get('/supabase/db-state', async (c) => c.json(await readDbState(mgmt(), projectRef(readConfig()))));

  /** Apply config to the database (and write config + generated code). */
  app.post('/apply', async (c) => {
    const { config: raw, backupModules, siteUrl, skipFunctions } = await c.req.json();
    const config = parseOr400(raw);
    const m = mgmt();
    const ref = projectRef(config);
    return respondWithProgress(c, async (p) => {
      const keys = await m.apiKeys(ref);
      const result = await applyConfig(m, ref, keys, await catalogP, config, { backupModules, siteUrl, skipFunctions }, p);
      p.plan([{ id: 'save', label: 'Save your settings on this computer' }]);
      await p.step('save', async () => writeConfig(config), () => 'team/teamhub.config.json');
      return result;
    });
  });

  app.post('/admin', async (c) => {
    const body = await c.req.json();
    const input = z
      .object({ email: z.string().email(), password: z.string().min(8), name: z.string().min(1).max(80), types: z.record(z.string(), z.enum(['member', 'captain', 'mentor'])) })
      .parse(body);
    const m = mgmt();
    const ref = projectRef(readConfig());
    const keys = await m.apiKeys(ref);
    return c.json(await createAdmin(m, ref, keys.secret, input));
  });

  app.post('/auth/site-url', async (c) => {
    const { url } = await c.req.json<{ url: string }>();
    const config = readConfig();
    if (!config) throw new MgmtError('Save your config first.', 400);
    const next = { ...config, hosting: { ...config.hosting, url } };
    await configureAuth(mgmt(), projectRef(config), next, url);
    writeConfig(next);
    return c.json({ ok: true });
  });

  app.post('/email', async (c) => {
    const { on } = await c.req.json<{ on: boolean }>();
    const config = readConfig();
    if (!config) throw new MgmtError('No config yet.', 400);
    const next = { ...config, features: { ...config.features, email: on } };
    return respondWithProgress(c, async (p) => {
      p.plan([
        { id: 'auth', label: 'Save sign-in settings in Supabase' },
        { id: 'save', label: 'Save your settings on this computer' },
      ]);
      await p.step('auth', () => configureAuth(mgmt(), projectRef(config), next, config.hosting.url), () => (on ? 'Email confirmation on' : 'Email confirmation off'));
      await p.step('save', async () => writeConfig(next));
      return { ok: true };
    });
  });

  // ── Backup / import / season / danger ────────────────────────────────────
  app.post('/backup', async (c) => {
    const { modules } = await c.req.json<{ modules?: string[] }>().catch(() => ({ modules: undefined }));
    const config = readConfig();
    const m = mgmt();
    const ref = projectRef(config);
    return respondWithProgress(c, async (p) => exportData(m, ref, (await m.apiKeys(ref)).secret, await catalogP, config, { modules, label: 'teamhub-backup' }, p));
  });
  app.post('/import', async (c) => {
    const { path } = await c.req.json<{ path: string }>();
    if (!existsSync(path)) throw new MgmtError('Backup file not found.', 400);
    const m = mgmt();
    const ref = projectRef(readConfig());
    return respondWithProgress(c, async (p) => importData(m, ref, (await m.apiKeys(ref)).secret, path, p));
  });
  app.post('/season', async (c) => {
    const { label, modules } = await c.req.json<{ label: string; modules: string[] }>();
    if (!/^\d{4}[–-]\d{2}$/.test(label)) throw new MgmtError('Season labels look like 2026–27', 400);
    const config = readConfig();
    if (!config) throw new MgmtError('No config yet.', 400);
    const m = mgmt();
    const ref = projectRef(config);
    const next = label.replace('-', '–');
    return respondWithProgress(c, async (p) => {
      p.plan([
        { id: 'backup', label: 'Back up everything first' },
        { id: 'rollover', label: `Roll over your tabs and start ${next}` },
        { id: 'save', label: 'Save the new season in your settings' },
      ]);
      const keys = await m.apiKeys(ref);
      const backup = await p.step('backup', async () => exportData(m, ref, keys.secret, await catalogP, config, { label: 'before-new-season' }), (b) => b.path);
      const res = await p.step('rollover', async () => newSeason(m, ref, await catalogP, config, next, modules), (r) => (r.ran.length ? `Rolled over: ${r.ran.join(', ')}` : 'Label only'));
      await p.step('save', async () => writeConfig({ ...config, season: next }));
      return { ...res, backup };
    });
  });
  app.post('/danger/remove', async (c) => {
    const { confirm } = await c.req.json<{ confirm: string }>();
    const config = readConfig();
    if (!config) throw new MgmtError('No config yet.', 400);
    const expected = String(config.teams[0].number ?? config.teams[0].shortCode);
    if (confirm !== expected) throw new MgmtError(`Type ${expected} to confirm.`, 400);
    const m = mgmt();
    const ref = projectRef(config);
    return respondWithProgress(c, async (p) => {
      p.plan([
        { id: 'backup', label: 'Back up everything first' },
        { id: 'remove', label: 'Remove TeamHub from the database' },
      ]);
      const keys = await m.apiKeys(ref);
      const backup = await p.step('backup', async () => exportData(m, ref, keys.secret, await catalogP, config, { label: 'before-removal' }), (b) => b.path);
      await p.step('remove', async () => removeEverything(m, ref, keys.secret, await catalogP));
      return { ok: true, backup };
    });
  });

  // ── Files: config, branding, host files ─────────────────────────────────
  // The config file is committed to the team's (public) GitHub copy. Tool links can be private (team chat invites,
  // shared folders, portfolios), so they never go in it: the wizard puts them straight into the team's database when
  // it builds it, and they're edited in Admin > Tool links after that.
  const writeConfig = (config: TeamhubConfig) => {
    mkdirSync(teamDir(), { recursive: true });
    const { toolLinks: _private, ...publicConfig } = config;
    void _private;
    writeFileSync(configPath(), `${JSON.stringify(publicConfig, null, 2)}\n`);
  };
  app.post('/config', async (c) => {
    const config = parseOr400(await c.req.json());
    writeConfig(config);
    const res = await generate(config, await catalogP);
    return c.json({ ok: true, ...res });
  });

  app.post('/branding', async (c) => {
    const { name, dataUrl } = await c.req.json<{ name: string; dataUrl: string }>();
    if (!/^[a-z0-9][a-z0-9._-]{0,60}$/.test(name)) throw new MgmtError('Bad file name', 400);
    const m = /^data:(image\/(png|webp|svg\+xml|jpeg));base64,(.+)$/.exec(dataUrl);
    if (!m) throw new MgmtError('Logos must be PNG, WebP, JPEG or SVG', 400);
    const buf = Buffer.from(m[3], 'base64');
    if (buf.length > 600 * 1024) throw new MgmtError('Logo is too large after optimizing (max 600 KB)', 400);
    mkdirSync(join(teamDir(), 'branding'), { recursive: true });
    writeFileSync(join(teamDir(), 'branding', name), buf);
    return c.json({ path: `branding/${name}` });
  });

  app.post('/hosting/files', async (c) => {
    const { provider, programName } = await c.req.json();
    const git = await gitStatus();
    const files = hostFiles(provider, programName ?? 'teamhub', git.isRepo ? git.branch : 'main');
    return c.json({ written: writeHostFiles(files), files });
  });
  app.post('/hosting/check', async (c) => c.json(await checkSite((await c.req.json<{ url: string }>()).url)));
  app.post('/keepalive', async (c) => {
    const { updates = true } = await c.req.json<{ updates?: boolean }>().catch(() => ({ updates: true }));
    return c.json({ written: writeHostFiles([keepaliveFile(), ...(updates ? [updatesWorkflowFile()] : [])]) });
  });

  // ── Build & git ─────────────────────────────────────────────────────────
  /** Test build: the same steps your host runs, so a broken site is caught before anything is published. */
  const buildSite = async (p: Progress) => {
    p.plan([
      { id: 'generate', label: 'Turn your settings into site code' },
      { id: 'bundle', label: 'Build the website (a test: nothing is published)' },
    ]);
    const tail = (r: { stdout: string; stderr: string }) => String(r.stdout + r.stderr).split('\n').slice(-40).join('\n');
    p.set('generate', 'running');
    const gen = await sh('npm', ['run', 'generate'], { timeout: 300_000 });
    if (!gen.ok) {
      p.set('generate', 'failed', 'Your settings couldn’t be turned into site code');
      p.skipRest();
      return { ok: false, log: tail(gen) };
    }
    p.set('generate', 'done');
    p.set('bundle', 'running', 'Usually under a minute');
    const res = await sh('npm', ['run', 'build', '-w', '@teamhub/dashboard'], { timeout: 600_000 });
    p.set('bundle', res.ok ? 'done' : 'failed', res.ok ? 'The site builds' : 'The build failed: your live site is untouched');
    return { ok: res.ok, log: tail(res) };
  };
  app.post('/build', async (c) => {
    const config = readConfig();
    if (!config) throw new MgmtError('Save your config first.', 400);
    return respondWithProgress(c, (p) => buildSite(p));
  });
  app.get('/git', async (c) => c.json(await gitStatus()));

  // ── Updates (docs/updating.md) ────────────────────────────────────────────
  const pushCurrentBranch = async () => {
    const push = await sh('git', ['push'], { timeout: 180_000 });
    if (push.ok) return push;
    const branch = String((await sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout).trim();
    return sh('git', ['push', '-u', 'origin', branch], { timeout: 180_000 });
  };
  const ghContext = async () => {
    const [login, repo] = await Promise.all([sh('gh', ['api', 'user', '--jq', '.login']), sh('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'])]);
    return { login: login.ok ? login.stdout.trim() : null, repo: repo.ok ? repo.stdout.trim() : null };
  };
  app.get('/update/check', async (c) => c.json(await checkForUpdate(REPO_ROOT)));
  app.get('/update/state', async (c) => c.json(await readState(REPO_ROOT)));
  /** Step 1: backup, merge the release, install. The wizard then restarts to run the new code (step 2). */
  app.post('/update/start', async (c) => {
    const { tag } = await c.req.json<{ tag: string }>();
    if (!/^v\d+\.\d+\.\d+$/.test(tag ?? '')) throw new MgmtError('Unknown version', 400);
    const config = readConfig();
    if (!config) throw new MgmtError('Finish setup before updating.', 400);
    const m = mgmt();
    const ref = projectRef(config);
    return respondWithProgress(c, async (p) => {
      p.plan([
        { id: 'backup', label: 'Back up your data' },
        { id: 'download', label: `Get TeamHub ${tag.slice(1)}` },
        { id: 'install', label: 'Install it' },
      ]);
      const keys = await m.apiKeys(ref);
      const backup = await p.step('backup', async () => exportData(m, ref, keys.secret, await catalogP, config, { label: `before-update-to-${tag}` }), (b) => `Saved to ${b.path}`);
      p.set('download', 'running');
      const merged = await mergeRelease(REPO_ROOT, tag, backup.path);
      if (!merged.ok) {
        p.set('download', 'failed', merged.message);
        p.skipRest();
        return withStatus({ ok: false, conflicts: merged.conflicts, message: merged.message, backup: backup.path }, 409);
      }
      p.set('download', 'done');
      p.set('install', 'running', 'This can take a minute');
      const install = await installDependencies(REPO_ROOT);
      if (!install.ok) {
        p.set('install', 'failed', 'npm install failed');
        return withStatus({ ok: false, conflicts: [], message: `The new version was downloaded, but installing it failed. Run "npm install" in a terminal, then "npm run setup" > Update again.\n${String(install.stderr).slice(-1500)}`, backup: backup.path }, 500);
      }
      p.set('install', 'done');
      return { ok: true, restart: true, state: merged.state, backup: backup.path };
    });
  });
  /** Step 2 (running the new code): update the database and server functions, test-build, then publish. */
  app.post('/update/finish', async (c) => {
    const state = await readState(REPO_ROOT);
    if (!state || state.stage !== 'merged') throw new MgmtError('There is no update waiting to finish.', 400);
    const config = readConfig();
    if (!config) throw new MgmtError('No config found.', 400);
    const m = mgmt();
    const ref = projectRef(config);
    return respondWithProgress(c, async (p) => {
      const keys = await m.apiKeys(ref);
      const catalog = await catalogP;
      const { log } = await applyConfig(m, ref, keys, catalog, config, {}, p);
      const build = await buildSite(p);
      if (!build.ok) {
        log.push({ step: 'Test build failed: nothing was published, your live site is unchanged', ok: false, detail: build.log });
        p.skipRest();
        return { ok: false, log };
      }
      log.push({ step: 'Test build passed', ok: true });
      // Installing can rewrite package-lock.json; it goes up with the update so the next one isn't blocked by it.
      const pushed = await publish(`Update TeamHub to v${state.to}`, [...publishPaths(), 'package-lock.json'].filter((x) => existsSync(join(REPO_ROOT, x))), undefined, await ghContext(), p);
      log.push(pushed.ok ? { step: 'Published: your host is rebuilding the site', ok: true } : { step: 'Publish failed', ok: false, detail: pushed.problem ?? pushed.log });
      if (pushed.ok) await writeState(REPO_ROOT, { ...state, stage: 'done', at: new Date().toISOString() });
      return { ok: pushed.ok, log, version: state.to, problem: pushed.problem, fix: pushed.fix };
    });
  });
  /** Undo the last update's code and publish (the database stays: its changes are add-only and compatible). */
  app.post('/update/rollback', async (c) => {
    const r = await revertUpdate(REPO_ROOT);
    if (!r.ok) return c.json(r, 400);
    const push = await pushCurrentBranch();
    return c.json({ ...r, ok: push.ok, message: push.ok ? `${r.message} Your host is rebuilding the site.` : `${r.message} But publishing failed: ${String(push.stderr).trim()}` });
  });
  app.post('/restart', (c) => {
    if (!deps.onRestart) throw new MgmtError('Restart isn’t available here. Stop the wizard (Ctrl+C) and run "npm run setup" again.', 400);
    setTimeout(deps.onRestart, 300);
    return c.json({ ok: true });
  });
  const publishPaths = () => ['team', ...existingHostPaths()].filter((p) => existsSync(join(REPO_ROOT, p)));
  // What Publish would upload that isn't on GitHub yet: saved files (logos, settings, host files) and waiting commits.
  app.get('/git/waiting', async (c) => {
    const g = await gitStatus();
    if (!g.isRepo) return c.json({ files: [], commits: 0 });
    const paths = publishPaths();
    const files = g.dirty.filter((f: string) => paths.some((p) => f === p || f.startsWith(`${p}/`)));
    return c.json({ files, commits: g.unpushed ?? 0 });
  });
  app.post('/git/publish', async (c) => {
    const { message } = await c.req.json<{ message?: string }>();
    const paths = publishPaths();
    const login = await sh('gh', ['api', 'user', '--jq', '.login']);
    const repo = await sh('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
    return respondWithProgress(c, (p) => publish(message ?? 'Update TeamHub config', paths, undefined, { login: login.ok ? login.stdout.trim() : null, repo: repo.ok ? repo.stdout.trim() : null }, p));
  });
  app.post('/git/use-noreply-email', async (c) => c.json(await useNoreplyEmail()));
  app.post('/git/pull', async (c) => {
    const res = await sh('git', ['pull', '--ff-only'], { timeout: 180_000 });
    return c.json({ ok: res.ok, log: (res.stdout + res.stderr).trim() });
  });
  app.post('/git/fork', async (c) => {
    const { name } = await c.req.json<{ name?: string }>().catch(() => ({ name: undefined }));
    if (name && !isValidRepoName(name)) throw new MgmtError('Repository names can use letters, numbers, "-", "_" and "." only.', 400);
    const res = await sh('gh', ['repo', 'fork', '--remote', '--remote-name', 'origin', ...(name ? ['--fork-name', name] : [])], { timeout: 180_000 });
    return c.json({ ok: res.ok, log: (res.stdout + res.stderr).trim() });
  });

  return app;
}

export type { Catalog };
