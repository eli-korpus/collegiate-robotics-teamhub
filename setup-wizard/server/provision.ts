/**
 * Applies a config to a Supabase project (spec §5.2 step 10, §5.3 apply sequence, §5.4 update):
 * backup removed tabs → one transactional migration plan → bucket cleanup → edge functions + secrets → auth config.
 */
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import type { TeamhubConfig } from '@teamhub/config-schema';
import { LAYOUT, lit, planSql, planToSql, resolveConfig, type Catalog, type DbState, type Plan } from '@teamhub/generator';
import { CORE_FUNCTIONS, PUBLIC_FUNCTIONS } from '@teamhub/sdk/define';
import { deleteBuckets, exportData, type ExportResult } from './backup';
import { projectUrl, type Mgmt } from './mgmt';
import { createProgress, type Progress } from './progress';

export interface StepLog {
  step: string;
  ok: boolean;
  detail?: string;
}

export async function readDbState(m: Mgmt, ref: string): Promise<DbState | null> {
  const [r] = await m.query<{ ok: boolean }>(ref, `select to_regclass('public.teamhub_modules') is not null as ok`);
  if (!r?.ok) return null;
  const rows = await m.query<{ id: string; version: number; state: 'active' | 'dormant' }>(ref, 'select id, version, state from teamhub_modules');
  return { versions: Object.fromEntries(rows.map((x) => [x.id, { version: x.version, state: x.state }])) };
}

export function computePlan(catalog: Catalog, config: TeamhubConfig, db: DbState | null): Plan {
  return planSql(resolveConfig(config, catalog), db, { cron: true });
}

export interface ApplyOptions {
  siteUrl?: string | null;
  /** export these modules before applying (tabs being removed or made dormant) */
  backupModules?: string[];
  skipFunctions?: boolean;
}

/**
 * SQL that sets the live email-domain rule (Admin > Who can join), or null when the wizard shouldn't touch it.
 * The database remembers the list the wizard last wrote, so the wizard only writes when its own list changed: a change
 * an admin made in the dashboard isn't undone by an unrelated wizard edit.
 */
export function joinRulesSql(config: TeamhubConfig, lastWritten: string | null): string | null {
  const next = JSON.stringify([...config.join.allowedEmailDomains].sort());
  if (lastWritten === next) return null;
  return `update teamhub_settings set allowed_email_domains = array[${config.join.allowedEmailDomains.map(lit).join(', ')}]::text[] where id = 1;
insert into teamhub_private.config (key, value) values ('wizard_join_domains', ${lit(next)}) on conflict (key) do update set value = excluded.value;`;
}

export async function applyConfig(
  m: Mgmt,
  ref: string,
  keys: { secret: string },
  catalog: Catalog,
  config: TeamhubConfig,
  opts: ApplyOptions = {},
  progress: Progress = createProgress(),
): Promise<{ log: StepLog[]; backup?: ExportResult }> {
  const log: StepLog[] = [];
  const backingUp = !!opts.backupModules?.length;
  progress.plan([{ id: 'connect', label: 'Connect to your database' }, ...(backingUp ? [{ id: 'backup', label: 'Back up the tabs you are removing' }] : [])]);

  const db = await progress.step('connect', async () => {
    const state = await readDbState(m, ref);
    // Extensions for scheduled cleanup (available on every Supabase project).
    await m.query(ref, `create extension if not exists pg_cron with schema pg_catalog; create extension if not exists pg_net with schema extensions;`);
    return state;
  });
  let backup: ExportResult | undefined;
  if (backingUp) {
    if (db) {
      backup = await progress.step('backup', () => exportData(m, ref, keys.secret, catalog, config, { modules: opts.backupModules, includeCore: false, label: `before-removing-${opts.backupModules!.join('-')}` }), (b) => `Saved to ${b.path}`);
      log.push({ step: `Backed up ${opts.backupModules!.join(', ')}`, ok: true, detail: backup.path });
    } else progress.set('backup', 'skipped', 'Nothing to back up yet');
  }

  const plan = computePlan(catalog, config, db);
  progress.plan([
    { id: 'schema', label: 'Update tables and security rules' },
    ...(plan.bucketsToDelete.length ? [{ id: 'storage', label: 'Delete file storage of removed tabs' }] : []),
    ...(opts.skipFunctions ? [] : [{ id: 'functions', label: 'Install server functions (password links, cleanup)' }]),
    { id: 'join', label: 'Save who can sign up' },
    { id: 'auth', label: 'Save sign-in settings' },
    { id: 'check', label: 'Check that your website can reach the database' },
  ]);

  const migrated = plan.summary.migrations.map((x) => `${x.id} v${x.from} to v${x.to}`).join(', ') || 'no table changes, rules refreshed';
  await progress.step('schema', () => m.query(ref, planToSql(plan, true)), () => migrated);
  log.push({ step: 'Database updated', ok: true, detail: migrated });

  if (plan.bucketsToDelete.length) {
    await progress.step('storage', () => deleteBuckets(m, ref, keys.secret, plan.bucketsToDelete), () => plan.bucketsToDelete.join(', '));
    log.push({ step: `Deleted file storage: ${plan.bucketsToDelete.join(', ')}`, ok: true });
  }

  // Cleanup function wiring: functions URL + shared secret kept in a private schema and in function secrets.
  const [existing] = await m.query<{ value: string | null }>(ref, `select value from teamhub_private.config where key = 'cleanup_secret'`);
  const secret = existing?.value ?? randomBytes(24).toString('hex');
  await m.query(
    ref,
    `insert into teamhub_private.config (key, value) values ('functions_url', ${lit(`${projectUrl(ref)}/functions/v1`)}), ('cleanup_secret', ${lit(secret)})
     on conflict (key) do update set value = excluded.value`,
  );

  if (!opts.skipFunctions) {
    progress.set('functions', 'running');
    const fnRoot = join(catalog.root, LAYOUT.functions);
    const fns = new Set<string>(CORE_FUNCTIONS);
    for (const [id] of Object.entries(config.modules).filter(([, e]) => e.state === 'active')) {
      for (const f of catalog.modules.get(id)?.manifest.functions ?? []) fns.add(f);
    }
    const failed: string[] = [];
    let n = 0;
    for (const f of fns) {
      const dir = join(fnRoot, f);
      if (!existsSync(dir)) continue;
      progress.set('functions', 'running', `Installing ${f}…`);
      try {
        await m.deployFunction(ref, f, dir, !PUBLIC_FUNCTIONS.includes(f));
        log.push({ step: `Deployed function ${f}`, ok: true });
        n++;
      } catch (e) {
        log.push({ step: `Deploy function ${f}`, ok: false, detail: (e as Error).message });
        failed.push(`${f}: ${(e as Error).message}`);
      }
    }
    try {
      await m.setSecrets(ref, [{ name: 'TEAMHUB_CLEANUP_SECRET', value: secret }]);
      log.push({ step: 'Function secrets set', ok: true });
    } catch (e) {
      log.push({ step: 'Set function secrets', ok: false, detail: (e as Error).message });
      failed.push(`secrets: ${(e as Error).message}`);
    }
    // A function that didn't install is reported but doesn't stop the rest (the database is already updated).
    progress.set('functions', failed.length ? 'failed' : 'done', failed.length ? failed.join('; ') : `${n} installed`);
  }

  const [lastJoin] = await m.query<{ value: string | null }>(ref, `select value from teamhub_private.config where key = 'wizard_join_domains'`);
  const joinSql = joinRulesSql(config, lastJoin?.value ?? null);
  const d = config.join.allowedEmailDomains;
  const joinDetail = d.length ? `only ${d.map((x) => '@' + x).join(', ')} emails` : 'anyone with the join link';
  if (joinSql) {
    await progress.step('join', () => m.query(ref, joinSql), () => joinDetail);
    log.push({ step: 'Sign-up rule saved', ok: true, detail: joinDetail });
  } else progress.set('join', 'done', `No change (${joinDetail})`);

  const authDetail = config.features.email ? 'email confirmation on' : 'no email needed (approval is the gate)';
  await progress.step('auth', () => configureAuth(m, ref, config, opts.siteUrl ?? config.hosting.url), () => authDetail);
  log.push({ step: 'Sign-in settings configured', ok: true, detail: authDetail });

  // Last: prove the website will be able to talk to the database.
  progress.set('check', 'running');
  const keysForPing = await m.apiKeys(ref).catch(() => null);
  if (keysForPing) {
    const ping = await pingDataApi(m, ref, keysForPing.publishable);
    log.push({ step: ping.ok ? 'Data API check passed' : 'Data API check failed', ok: ping.ok, detail: ping.detail });
    progress.set('check', ping.ok ? 'done' : 'failed', ping.detail);
  } else progress.set('check', 'skipped', 'Couldn’t read the project keys to check');
  return { log, backup };
}

export interface DataApiStatus {
  /** Schemas the Data API serves (empty = Data API turned off). */
  schemas: string[];
  /** TeamHub needs the public schema exposed. */
  ok: boolean;
}

/** Is the project's Data API on and serving the public schema? (Supabase lets new projects turn it off or use "api".) */
export async function dataApiStatus(m: Mgmt, ref: string): Promise<DataApiStatus> {
  const cfg = await m.getPostgrest(ref);
  const schemas = (cfg.db_schema ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return { schemas, ok: schemas.includes('public') };
}

/** Adds the public schema to the Data API (keeping any others, e.g. graphql_public). */
export async function exposePublicSchema(m: Mgmt, ref: string): Promise<DataApiStatus> {
  const { schemas } = await dataApiStatus(m, ref);
  await m.updatePostgrest(ref, { db_schema: ['public', ...schemas.filter((s) => s !== 'public')].join(', ') });
  return dataApiStatus(m, ref);
}

/** End-to-end check the website will depend on: call the keep-alive function through the Data API, signed out. */
export async function pingDataApi(m: Mgmt, ref: string, publishableKey: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await m.fetchProject(`${projectUrl(ref)}/rest/v1/rpc/teamhub_ping`, {
      method: 'POST',
      headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (res.ok) return { ok: true, detail: 'the website can reach your database' };
    const text = await res.text().catch(() => '');
    return {
      ok: false,
      detail: `The Data API answered ${res.status}. In Supabase, open Project Settings > Data API (or Integrations > Data API), make sure it is enabled and that "public" is an exposed schema, then click Apply again. ${text.slice(0, 200)}`,
    };
  } catch (e) {
    return { ok: false, detail: `Could not reach the Data API: ${(e as Error).message}` };
  }
}

/** Email/password on, signups on, confirmation off unless the team added SMTP (spec §7.5); site URL + redirects. */
export async function configureAuth(m: Mgmt, ref: string, config: TeamhubConfig, siteUrl?: string | null) {
  const urls = new Set<string>(['http://localhost:5173/**', 'http://localhost:4173/**']);
  if (siteUrl) urls.add(`${siteUrl.replace(/\/$/, '')}/**`);
  await m.updateAuthConfig(ref, {
    disable_signup: false,
    external_email_enabled: true,
    mailer_autoconfirm: !config.features.email,
    ...(siteUrl ? { site_url: siteUrl } : {}),
    uri_allow_list: [...urls].join(','),
  });
}

/** First admin account (spec §5.2 step 11). The secret key is used here, locally, and never stored. */
export async function createAdmin(
  m: Mgmt,
  ref: string,
  secretKey: string,
  input: { email: string; password: string; name: string; types: Record<string, 'member' | 'captain' | 'mentor'> },
) {
  const sb = createClient(projectUrl(ref), secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // The admin can always sign in, even if their email isn't on an allowed domain (Admin > Who can join lists it).
  await m.query(
    ref,
    `insert into teamhub_allowed_emails (email, note) select e, 'Admin account from setup' from (values (${lit(input.email.trim().toLowerCase())})) v(e)
     where not teamhub_email_allowed(e) on conflict (email) do nothing`,
  );
  const { data, error } = await sb.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name, teams: Object.keys(input.types), requested_type: 'mentor' },
  });
  let id = data.user?.id;
  if (error) {
    if (!/already/i.test(error.message)) throw error;
    const [u] = await m.query<{ id: string }>(ref, `select id from auth.users where email = ${lit(input.email.toLowerCase())}`);
    if (!u) throw error;
    id = u.id;
  }
  const values = Object.entries(input.types)
    .map(([team, type]) => `(${lit(id!)}::uuid, ${lit(team)}::uuid, ${lit(type)}, 'active', ${lit(type)})`)
    .join(', ');
  await m.query(
    ref,
    `begin;
     insert into profiles (id, display_name, status, is_admin) values (${lit(id!)}::uuid, ${lit(input.name)}, 'active', true)
       on conflict (id) do update set status = 'active', is_admin = true, display_name = excluded.display_name;
     ${values ? `insert into memberships (user_id, team_id, type, status, requested_type) values ${values}
       on conflict (user_id, team_id) do update set type = excluded.type, status = 'active';` : ''}
     commit;`,
  );
  return { id };
}

/** New Season (spec §5.5): per-module rollover SQL, then the new label. Export first. */
export async function newSeason(m: Mgmt, ref: string, catalog: Catalog, config: TeamhubConfig, newLabel: string, modules: string[]) {
  const [cur] = await m.query<{ season_label: string }>(ref, 'select season_label from teamhub_settings where id = 1');
  const old = cur?.season_label ?? config.season;
  const parts: string[] = [];
  for (const id of modules) {
    const sql = catalog.modules.get(id)?.manifest.seasonRollover?.sql;
    if (sql?.trim()) parts.push(`-- ${id}\n${sql.replaceAll(':old', lit(old)).replaceAll(':new', lit(newLabel))}`);
  }
  parts.push(`update teamhub_settings set season_label = ${lit(newLabel)} where id = 1;`);
  await m.query(ref, `begin;\n${parts.join('\n')}\ncommit;`);
  return { old, new: newLabel, ran: modules };
}

/** Danger zone: remove every TeamHub object (after an export). Auth users are kept. */
export async function removeEverything(m: Mgmt, ref: string, secretKey: string, catalog: Catalog) {
  const buckets = ['avatars', ...[...catalog.modules.values()].flatMap((c) => c.manifest.buckets.map((b) => b.id))];
  const existing = await m.query<{ id: string }>(ref, `select id from storage.buckets where id in (${buckets.map(lit).join(', ')})`);
  await deleteBuckets(m, ref, secretKey, existing.map((b) => b.id));
  const prefixes = [...[...catalog.integrations.values()].map((i) => i.manifest.prefix), ...[...catalog.modules.values()].map((c) => c.manifest.prefix).filter(Boolean)];
  await m.query(
    ref,
    `begin;
     ${prefixes.map((p) => `select teamhub_drop_prefix(${lit(p)});`).join('\n')}
     select teamhub_drop_policies('core_');
     do $$ begin if exists (select 1 from pg_namespace where nspname = 'cron') then perform cron.unschedule(jobname) from cron.job where starts_with(jobname, 'teamhub_'); end if; end $$;
     drop trigger if exists teamhub_on_auth_user_created on auth.users;
     drop trigger if exists teamhub_on_auth_user_deleted on auth.users;
     drop table if exists comments, notifications, info_requests, links, subteams, position_holders, positions, memberships, profiles_leaders, profiles_private, profiles, teams, teamhub_storage_trash, teamhub_settings, teamhub_modules cascade;
     drop schema if exists teamhub_private cascade;
     do $$ declare r record; begin
       for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and (p.proname like 'teamhub\\_%' or p.proname like 'people\\_%' or p.proname = 'info_request_status')
       loop execute format('drop function if exists %s cascade', r.sig); end loop;
     end $$;
     commit;`,
  );
}
