/**
 * Applies a config to a Supabase project (spec §5.2 step 10, §5.3 apply sequence, §5.4 update):
 * backup removed tabs → one transactional migration plan → bucket cleanup → edge functions + secrets → auth config.
 */
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import type { TeamhubConfig } from '@teamhub/config-schema';
import { lit, planSql, planToSql, resolveConfig, type Catalog, type DbState, type Plan } from '@teamhub/generator';
import { CORE_FUNCTIONS, PUBLIC_FUNCTIONS } from '@teamhub/sdk/define';
import { deleteBuckets, exportData, type ExportResult } from './backup';
import { projectUrl, type Mgmt } from './mgmt';

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

export async function applyConfig(
  m: Mgmt,
  ref: string,
  keys: { secret: string },
  catalog: Catalog,
  config: TeamhubConfig,
  opts: ApplyOptions = {},
): Promise<{ log: StepLog[]; backup?: ExportResult }> {
  const log: StepLog[] = [];
  const db = await readDbState(m, ref);
  let backup: ExportResult | undefined;
  if (opts.backupModules?.length && db) {
    backup = await exportData(m, ref, keys.secret, catalog, config, { modules: opts.backupModules, includeCore: false, label: `before-removing-${opts.backupModules.join('-')}` });
    log.push({ step: `Backed up ${opts.backupModules.join(', ')}`, ok: true, detail: backup.path });
  }

  // Extensions for scheduled cleanup (available on every Supabase project).
  await m.query(ref, `create extension if not exists pg_cron with schema pg_catalog; create extension if not exists pg_net with schema extensions;`);

  const plan = computePlan(catalog, config, db);
  await m.query(ref, planToSql(plan, true));
  log.push({ step: 'Database updated', ok: true, detail: `${plan.summary.migrations.map((x) => `${x.id} v${x.from} to v${x.to}`).join(', ') || 'no schema changes'}` });

  if (plan.bucketsToDelete.length) {
    await deleteBuckets(m, ref, keys.secret, plan.bucketsToDelete);
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
    const fnRoot = join(catalog.root, 'supabase', 'functions');
    const fns = new Set<string>(CORE_FUNCTIONS);
    for (const [id] of Object.entries(config.modules).filter(([, e]) => e.state === 'active')) {
      for (const f of catalog.modules.get(id)?.manifest.functions ?? []) fns.add(f);
    }
    for (const f of fns) {
      const dir = join(fnRoot, f);
      if (!existsSync(dir)) continue;
      try {
        await m.deployFunction(ref, f, dir, !PUBLIC_FUNCTIONS.includes(f));
        log.push({ step: `Deployed function ${f}`, ok: true });
      } catch (e) {
        log.push({ step: `Deploy function ${f}`, ok: false, detail: (e as Error).message });
      }
    }
    try {
      await m.setSecrets(ref, [{ name: 'TEAMHUB_CLEANUP_SECRET', value: secret }]);
      log.push({ step: 'Function secrets set', ok: true });
    } catch (e) {
      log.push({ step: 'Set function secrets', ok: false, detail: (e as Error).message });
    }
  }

  await configureAuth(m, ref, config, opts.siteUrl ?? config.hosting.url);
  log.push({ step: 'Sign-in settings configured', ok: true, detail: config.features.email ? 'email confirmation on' : 'no email needed (approval is the gate)' });
  return { log, backup };
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
     drop table if exists comments, notifications, info_requests, links, subteams, position_holders, positions, memberships, profiles_private, profiles, teams, teamhub_storage_trash, teamhub_settings, teamhub_modules cascade;
     drop schema if exists teamhub_private cascade;
     do $$ declare r record; begin
       for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and (p.proname like 'teamhub\\_%' or p.proname like 'people\\_%' or p.proname = 'info_request_status')
       loop execute format('drop function if exists %s cascade', r.sig); end loop;
     end $$;
     commit;`,
  );
}
