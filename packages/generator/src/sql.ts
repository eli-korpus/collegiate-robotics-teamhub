import type { PermissionGrant } from '@teamhub/config-schema';
import { fieldLevel } from '@teamhub/config-schema/util';
import type { BucketDef } from '@teamhub/sdk/define';
import type { Resolved } from './resolve';

export const lit = (s: string | null | undefined): string => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const arr = (xs: string[]) => (xs.length ? `array[${xs.map(lit).join(', ')}]::text[]` : `'{}'::text[]`);

/** What the DB currently has installed (from teamhub_modules). null = fresh database. */
export interface DbState {
  versions: Record<string, { version: number; state: 'active' | 'dormant' }>;
}

export interface PlanStep {
  title: string;
  sql: string;
}

export interface PlanSummary {
  tables: number;
  functions: number;
  buckets: number;
  cronJobs: number;
  dropsModules: string[];
  dormantModules: string[];
  migrations: { id: string; from: number; to: number }[];
}

export interface Plan {
  steps: PlanStep[];
  summary: PlanSummary;
  /** Buckets the wizard must empty + delete through the Storage API (SQL cannot delete objects). */
  bucketsToDelete: string[];
}

export interface PlanOptions {
  /** Include pg_cron jobs (true on Supabase; false in PGlite tests). */
  cron?: boolean;
}

function grantExpr(g: PermissionGrant): string | null {
  const parts: string[] = [];
  if (g.types.length) parts.push(`teamhub_has_type(p_team, ${arr(g.types)})`);
  if (g.positions.length) parts.push(`teamhub_has_position(p_team, ${arr(g.positions)})`);
  return parts.length ? parts.join(' or ') : null;
}

/** The compiled permission function (spec §7.4) + inverse lookup + ref visibility. */
export function compileFunctions(r: Resolved): string {
  const keys = Object.keys(r.matrix).sort();
  const canCases = keys
    .map((k) => {
      const e = grantExpr(r.matrix[k]);
      return e ? `      when ${lit(k)} then ${e}` : null;
    })
    .filter(Boolean)
    .join('\n');
  const typeCases = keys
    .filter((k) => r.matrix[k].types.length)
    .map((k) => `      when ${lit(k)} then ${arr(r.matrix[k].types)}`)
    .join('\n');
  const posCases = keys
    .filter((k) => r.matrix[k].positions.length)
    .map((k) => `      when ${lit(k)} then ${arr(r.matrix[k].positions)}`)
    .join('\n');

  const refCases: string[] = [];
  for (const m of r.modules) {
    if (m.state !== 'active') continue;
    const vis = m.catalog.manifest.refVisibility ?? {};
    const inner = Object.entries(vis)
      .map(([entity, tmpl]) => `        when ${lit(entity)} then ${tmpl.replaceAll('{id}', `split_part(p_ref, ':', 3)`)}`)
      .join('\n');
    if (inner) refCases.push(`      when ${lit(m.id)} then case split_part(p_ref, ':', 2)\n${inner}\n        else false end`);
  }

  return `-- Compiled from teamhub.config.json. Do not edit by hand.
create or replace function teamhub_can(perm text, p_team uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select teamhub_is_admin() or coalesce(case perm
${canCases || "      when '' then false"}
      else false
    end, false)
$$;

create or replace function teamhub_users_with(perm text, p_team uuid default null) returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where is_admin and status = 'active'
  union
  select m.user_id from memberships m join profiles p on p.id = m.user_id and p.status = 'active'
  where m.status = 'active' and (p_team is null or m.team_id = p_team)
    and m.type = any (case perm
${typeCases || "      when '' then '{}'::text[]"}
      else '{}'::text[] end)
  union
  select h.user_id from position_holders h join profiles p on p.id = h.user_id and p.status = 'active'
  where (p_team is null or h.team_id is null or h.team_id = p_team)
    and h.position_id = any (case perm
${posCases || "      when '' then '{}'::text[]"}
      else '{}'::text[] end)
$$;

create or replace function teamhub_ref_visible(p_ref text) returns boolean
language sql stable security definer set search_path = public as $$
  select teamhub_is_active() and coalesce(case split_part(p_ref, ':', 1)
${refCases.join('\n') || "      when '' then false"}
      else false
    end, false)
$$;
`;
}

/**
 * Module SQL may reference wizard settings as {{settings.name}} (e.g. auto-delete days in a cron job).
 * Numbers/booleans are inlined; strings become SQL literals.
 */
export function applySettings(sql: string, settings: Record<string, unknown>): string {
  return sql.replace(/\{\{settings\.(\w+)\}\}/g, (_m, k: string) => {
    const v = settings[k];
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "string") return lit(v);
    throw new Error(`Setting "${k}" used in SQL must be a number, boolean or string`);
  });
}

export function bucketSql(b: BucketDef): string {
  return `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (${lit(b.id)}, ${lit(b.id)}, ${b.public}, ${Math.round(b.maxFileMB * 1024 * 1024)}, ${arr(b.mime)})
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;`;
}

export function bucketPoliciesSql(prefix: string, b: BucketDef): string {
  const n = `${prefix}st_${b.id.replace(/[^a-z0-9]/g, '_')}`;
  return `create policy ${n}_read on storage.objects for select to authenticated
  using (bucket_id = ${lit(b.id)} and teamhub_in_team(teamhub_path_team(name)));
create policy ${n}_insert on storage.objects for insert to authenticated
  with check (bucket_id = ${lit(b.id)} and teamhub_can(${lit(b.uploadPerm)}, teamhub_path_team(name)));
create policy ${n}_delete on storage.objects for delete to authenticated
  using (bucket_id = ${lit(b.id)} and (owner_id = (select auth.uid())::text or teamhub_can(${lit(b.deleteAnyPerm)}, teamhub_path_team(name))));`;
}

export const AVATAR_BUCKET: BucketDef = {
  id: 'avatars',
  public: false,
  maxFileMB: 0.05,
  mime: ['image/webp', 'image/png', 'image/jpeg'],
  uploadPerm: 'core.avatar',
  deleteAnyPerm: 'core.avatar',
};

/**
 * Last step of every plan, so it covers everything any tab created: signed-out visitors can't touch a single table and
 * can only call the keep-alive ping and the sign-up page's email rule. Row-level security already hides every row from
 * them; this is a second layer. (Signed-in users keep their explicit grants from database/policies.sql, and triggers
 * don't need call permission.)
 */
export const ANON_LOCKDOWN = `-- Signed-out visitors
revoke select, insert, update, delete on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on function teamhub_ping(), teamhub_join_rules() to anon;`;

/** Syncs config-owned rows (teams, subteams, config positions, season, first-run links). */
export function configSyncSql(r: Resolved): string {
  const c = r.config;
  const teams = c.teams
    .map((t, i) => `(${lit(t.id)}, ${t.number ?? 'null'}, ${lit(t.name)}, ${lit(t.shortCode.toUpperCase())}, ${lit(t.color)}, ${i})`)
    .join(',\n  ');
  const lines = [
    `insert into teams (id, number, name, short_code, color, sort) values\n  ${teams}\non conflict (id) do update set number = excluded.number, name = excluded.name,\n  short_code = excluded.short_code, color = excluded.color, sort = excluded.sort, archived = false;`,
    `update teams set archived = true where id not in (${c.teams.map((t) => lit(t.id)).join(', ')});`,
  ];
  if (c.subteams.length) {
    lines.push(
      `insert into subteams (id, name, sort) values\n  ${c.subteams.map((s, i) => `(${lit(s.id)}, ${lit(s.name)}, ${i})`).join(',\n  ')}\non conflict (id) do update set name = excluded.name, sort = excluded.sort;`,
    );
  }
  lines.push(`delete from subteams where id not in (${c.subteams.map((s) => lit(s.id)).join(', ') || "''"});`);
  if (c.positions.length) {
    lines.push(
      `insert into positions (id, name, team_id, grants_permissions, source, per_team) values\n  ${c.positions
        .map((p) => `(${lit(p.id)}, ${lit(p.name)}, ${p.teamId && !p.perTeam ? lit(p.teamId) + '::uuid' : 'null'}, ${p.grantsPermissions}, 'config', ${!!p.perTeam})`)
        .join(
          ',\n  ',
        )}\non conflict (id) do update set name = excluded.name, team_id = excluded.team_id,\n  grants_permissions = excluded.grants_permissions, source = 'config', per_team = excluded.per_team;`,
    );
  }
  lines.push(
    `delete from positions where source = 'config' and id not in (${c.positions.map((p) => lit(p.id)).join(', ') || "''"});`,
  );
  lines.push(`insert into teamhub_settings (id, season_label) values (1, ${lit(c.season)}) on conflict (id) do nothing;`);
  // Profile answers live where each field's visibility says (moves them when a field's level changes).
  for (const f of c.profileFields) lines.push(`select teamhub_place_profile_field(${lit(f.id)}, ${lit(fieldLevel(f))});`);
  if (c.toolLinks.length) {
    const vals = c.toolLinks
      // A team's own link only when that team exists (and the program really has several teams).
      .map((l, i) => `(${lit(l.label)}, ${lit(l.url)}, ${lit(l.description)}, ${lit(l.slot)}, ${lit(l.section)}, ${i}, ${l.teamId && c.program.multiTeam && c.teams.some((t) => t.id === l.teamId) ? lit(l.teamId) + '::uuid' : 'null::uuid'})`)
      .join(',\n  ');
    lines.push(
      `-- Seed tool links once; afterwards they are edited in-app.\ninsert into links (label, url, description, slot, section, sort, team_id)\nselect * from (values\n  ${vals}\n) v(label, url, description, slot, section, sort, team_id)\nwhere not exists (select 1 from links);`,
    );
  }
  return lines.join('\n\n');
}

function stripped(sql: string) {
  return sql.replace(/--.*$/gm, '');
}

export function planSql(r: Resolved, db: DbState | null, opts: PlanOptions = {}): Plan {
  if (r.errors.length) throw new Error(`Config has errors:\n- ${r.errors.join('\n- ')}`);
  const steps: PlanStep[] = [];
  const v = db?.versions ?? {};
  const summary: PlanSummary = {
    tables: 0,
    functions: 0,
    buckets: 0,
    cronJobs: 0,
    dropsModules: [],
    dormantModules: [],
    migrations: [],
  };
  const countSql = (sql: string) => {
    const s = stripped(sql);
    summary.tables += (s.match(/create table/gi) ?? []).length;
    summary.functions += (s.match(/create (or replace )?function/gi) ?? []).length;
  };
  const versionRows: string[] = [];

  // 1. Core migrations
  const coreFrom = v.core?.version ?? 0;
  const coreMigs = r.catalog.core.migrations.slice(coreFrom);
  if (coreMigs.length) {
    const sql = coreMigs.map((m) => `-- database/migrations/${m.name}\n${m.sql}`).join('\n\n');
    countSql(sql);
    steps.push({ title: 'Core database', sql });
    summary.migrations.push({ id: 'core', from: coreFrom, to: r.catalog.core.version });
  }
  versionRows.push(`(${lit('core')}, ${r.catalog.core.version}, 'active')`);

  // 2. Config-owned rows
  steps.push({ title: 'Teams, subteams, positions and season', sql: configSyncSql(r) });

  const installedIds = new Set(r.modules.map((m) => m.id));
  const installedIx = new Set(r.installedIntegrations.map((i) => i.manifest.id));

  // 3. Tear down integrations whose modules are gone, then deleted modules
  const downs: string[] = [];
  for (const [id, ix] of r.catalog.integrations) {
    if (v[id] && !installedIx.has(id)) {
      downs.push(`-- integration ${id}\n${ix.manifest.down}\nselect teamhub_drop_prefix(${lit(ix.manifest.prefix)});\ndelete from teamhub_modules where id = ${lit(id)};`);
    }
  }
  const bucketsToDelete: string[] = [];
  for (const id of Object.keys(v)) {
    if (id === 'core' || id.includes('+') || installedIds.has(id)) continue;
    const cm = r.catalog.modules.get(id);
    if (!cm) continue;
    summary.dropsModules.push(id);
    bucketsToDelete.push(...cm.manifest.buckets.map((b) => b.id));
    if (cm.manifest.prefix) downs.push(`-- remove module ${id}\nselect teamhub_drop_prefix(${lit(cm.manifest.prefix)});`);
    downs.push(`delete from teamhub_modules where id = ${lit(id)};`);
  }
  if (downs.length) steps.push({ title: 'Remove deleted tabs', sql: downs.join('\n\n') });

  // 4. Module migrations
  for (const m of r.modules) {
    const from = v[m.id]?.version ?? 0;
    const migs = m.catalog.migrations.slice(from);
    if (migs.length) {
      const sql = migs.map((x) => `-- tabs/${m.id}/${x.name}\n${x.sql}`).join('\n\n');
      countSql(sql);
      steps.push({ title: `Tab: ${m.catalog.manifest.name}`, sql });
      summary.migrations.push({ id: m.id, from, to: m.catalog.version });
    }
    if (m.state === 'dormant') summary.dormantModules.push(m.id);
    versionRows.push(`(${lit(m.id)}, ${m.catalog.version}, ${lit(m.state)})`);
  }

  // 5. Integration migrations
  for (const ix of r.installedIntegrations) {
    const id = ix.manifest.id;
    const from = v[id]?.version ?? 0;
    const migs = ix.migrations.slice(from);
    if (migs.length) {
      const sql = migs.map((x) => `-- tabs/integrations/${id}/${x.name}\n${x.sql}`).join('\n\n');
      countSql(sql);
      steps.push({ title: `Integration: ${id}`, sql });
      summary.migrations.push({ id, from, to: ix.version });
    }
    versionRows.push(`(${lit(id)}, ${ix.version}, 'active')`);
  }

  // 6. Compiled functions
  steps.push({ title: 'Permissions', sql: compileFunctions(r) });

  // 7. Policies + storage
  const pol: string[] = [`select teamhub_drop_policies('core_');`, r.catalog.core.policies];
  const buckets: string[] = [bucketSql(AVATAR_BUCKET)];
  summary.buckets++;
  for (const m of r.modules) {
    const man = m.catalog.manifest;
    for (const b of man.buckets) {
      buckets.push(bucketSql(b));
      summary.buckets++;
    }
    if (!man.prefix) continue;
    if (m.state === 'dormant') {
      pol.push(`-- ${m.id} (dormant: admins can read, nobody can write)\nselect teamhub_make_dormant(${lit(man.prefix)});`);
      continue;
    }
    pol.push(`-- ${m.id}\nselect teamhub_drop_policies(${lit(man.prefix)});\n${applySettings(m.catalog.policies, m.settings)}`);
    for (const b of man.buckets) pol.push(bucketPoliciesSql(man.prefix, b));
  }
  const activeIx = new Set(r.activeIntegrations.map((i) => i.manifest.id));
  for (const ix of r.installedIntegrations) {
    pol.push(`-- integration ${ix.manifest.id}\nselect teamhub_drop_policies(${lit(ix.manifest.prefix)});`);
    if (activeIx.has(ix.manifest.id) && ix.policies.trim()) pol.push(ix.policies);
  }
  pol.push(ANON_LOCKDOWN);
  steps.push({ title: 'File storage', sql: buckets.join('\n') });
  steps.push({ title: 'Access rules (RLS)', sql: pol.join('\n\n') });

  // 8. Scheduled jobs
  if (opts.cron) {
    const cron: string[] = [
      `create extension if not exists pg_cron with schema pg_catalog;`,
      `create extension if not exists pg_net with schema extensions;`,
      r.catalog.core.cron,
    ];
    for (const m of r.modules) {
      const prefix = m.catalog.manifest.prefix;
      if (m.state === 'active' && m.catalog.cron) cron.push(`-- ${m.id}\n${applySettings(m.catalog.cron, m.settings)}`);
      else if (prefix) cron.push(`select cron.unschedule(jobname) from cron.job where starts_with(jobname, ${lit(prefix)});`);
    }
    const all = cron.join('\n\n');
    summary.cronJobs = (stripped(all).match(/cron\.schedule\(/g) ?? []).length;
    steps.push({ title: 'Scheduled cleanup jobs', sql: all });
  }

  // 9. Record versions
  steps.push({
    title: 'Record versions',
    sql: `insert into teamhub_modules (id, version, state) values\n  ${versionRows.join(',\n  ')}\non conflict (id) do update set version = excluded.version, state = excluded.state, updated_at = now();\nnotify pgrst, 'reload schema';`,
  });

  return { steps, summary, bucketsToDelete };
}

export function planToSql(plan: Plan, transaction = true): string {
  const body = plan.steps.map((s) => `-- ═══ ${s.title} ═══\n${s.sql}`).join('\n\n');
  return transaction ? `begin;\n\n${body}\n\ncommit;\n` : body;
}

export function describePlan(plan: Plan): string[] {
  const s = plan.summary;
  const out: string[] = [];
  if (s.tables) out.push(`Create ${s.tables} table${s.tables === 1 ? '' : 's'}`);
  if (s.functions) out.push(`Create or update ${s.functions} function${s.functions === 1 ? '' : 's'}`);
  out.push(`Set up ${s.buckets} storage bucket${s.buckets === 1 ? '' : 's'}`);
  if (s.cronJobs) out.push(`Schedule ${s.cronJobs} cleanup job${s.cronJobs === 1 ? '' : 's'}`);
  if (s.dormantModules.length) out.push(`Keep ${s.dormantModules.join(', ')} dormant (read-only for admins)`);
  if (s.dropsModules.length) out.push(`Delete all data of: ${s.dropsModules.join(', ')}`);
  out.push('Compile the permission matrix into access rules');
  return out;
}
