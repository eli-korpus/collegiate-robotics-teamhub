/**
 * In-process Postgres (PGlite) with just enough of Supabase stubbed (auth, storage, roles, default grants)
 * to apply generated migration plans and test RLS. Not identical to Supabase. See docs/testing.md.
 */
import { PGlite } from '@electric-sql/pglite';
import { parseConfig, type TeamhubConfig, type TeamhubConfigInput } from '@teamhub/config-schema';
import { loadCatalog, planSql, planToSql, resolveConfig, type Catalog, type DbState, type Plan } from '@teamhub/generator';

export const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}',
  created_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
grant usage on schema storage to anon, authenticated;
create table storage.buckets (
  id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[],
  created_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text,
  owner uuid, owner_id text, metadata jsonb, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
create publication supabase_realtime;
`;

export class TestDb {
  constructor(public pg: PGlite) {}

  /** Run as the database owner (like the wizard / migrations). */
  async admin<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.pg.exec('reset role');
    return (await this.pg.query<T>(sql, params)).rows;
  }
  async exec(sql: string) {
    await this.pg.exec('reset role');
    await this.pg.exec(sql);
  }

  /** Run a query as a signed-in user, with RLS. */
  async as<T = any>(userId: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
    await this.pg.exec('reset role');
    await this.pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
    await this.pg.exec(`set role ${userId ? 'authenticated' : 'anon'}`);
    try {
      return (await this.pg.query<T>(sql, params)).rows;
    } finally {
      await this.pg.exec('reset role');
    }
  }

  /** Expect a statement to fail for this user (RLS or permission error, or zero rows affected). */
  async denied(userId: string | null, sql: string, params: unknown[] = []): Promise<boolean> {
    try {
      await this.pg.exec('reset role');
      await this.pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
      await this.pg.exec(`set role ${userId ? 'authenticated' : 'anon'}`);
      const res = await this.pg.query(sql, params);
      return (res.affectedRows ?? 0) === 0 && res.rows.length === 0;
    } catch {
      return true;
    } finally {
      await this.pg.exec('reset role');
    }
  }

  async dbState(): Promise<DbState> {
    const rows = await this.admin<{ id: string; version: number; state: 'active' | 'dormant' }>(
      'select id, version, state from teamhub_modules',
    );
    return { versions: Object.fromEntries(rows.map((r) => [r.id, { version: r.version, state: r.state }])) };
  }

  /** Applies the plan for `config` (pass a catalog to simulate another release's modules). */
  async applyConfig(config: TeamhubConfig, fresh = false, catalog?: Catalog): Promise<Plan> {
    catalog ??= await loadCatalog();
    const r = resolveConfig(config, catalog);
    const plan = planSql(r, fresh ? null : await this.dbState().catch(() => null), { cron: false });
    await this.exec(planToSql(plan, true));
    return plan;
  }

  /** Creates an auth user (trigger creates the pending profile + memberships). */
  async signUp(email: string, meta: Record<string, unknown> = {}): Promise<string> {
    const [row] = await this.admin<{ id: string }>(
      'insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id',
      [email, JSON.stringify(meta)],
    );
    return row.id;
  }

  /** Creates an active user with memberships (bypasses approval for test setup). */
  async user(
    name: string,
    teams: Record<string, 'member' | 'captain' | 'mentor'>,
    opts: { admin?: boolean; positions?: string[] } = {},
  ): Promise<string> {
    const id = await this.signUp(`${name.toLowerCase().replace(/\W/g, '')}-${Math.random().toString(36).slice(2, 7)}@test.dev`, { name });
    await this.admin(`update profiles set status = 'active', is_admin = $2 where id = $1`, [id, !!opts.admin]);
    for (const [team, type] of Object.entries(teams)) {
      await this.admin(
        `insert into memberships (user_id, team_id, type, status) values ($1, $2, $3, 'active')
         on conflict (user_id, team_id) do update set type = excluded.type, status = 'active'`,
        [id, team, type],
      );
    }
    for (const p of opts.positions ?? []) {
      await this.admin(
        `insert into position_holders (position_id, user_id, team_id) select $1, $2, team_id from positions where id = $1`,
        [p, id],
      );
    }
    return id;
  }
}

export async function createTestDb(): Promise<TestDb> {
  const pg = new PGlite();
  await pg.exec(SUPABASE_STUB);
  return new TestDb(pg);
}

export const TEAM_A = '11111111-1111-4111-8111-111111111111';
export const TEAM_B = '22222222-2222-4222-8222-222222222222';

export function testConfig(overrides: Partial<TeamhubConfigInput> = {}): TeamhubConfig {
  const parsed = parseConfig({
    program: { name: 'Test Robotics', multiTeam: true },
    teams: [
      { id: TEAM_A, number: 12345, name: 'Alpha', shortCode: 'A', color: '#3B82F6' },
      { id: TEAM_B, number: 99999, name: 'Beta', shortCode: 'B', color: '#10B981' },
    ],
    season: '2026–27',
    subteams: [
      { id: 'build', name: 'Build' },
      { id: 'programming', name: 'Programming' },
    ],
    positions: [{ id: 'pos_lead_programmer', name: 'Lead Programmer', grantsPermissions: true }],
    ...overrides,
  });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.config;
}

/** Config enabling the given modules with default settings. */
export function withModules(ids: string[], overrides: Partial<TeamhubConfigInput> = {}): TeamhubConfig {
  return testConfig({ modules: Object.fromEntries(ids.map((id) => [id, { state: 'active', settings: {} }])), ...overrides });
}

/**
 * Today's catalog with core migrations only up to (not including) the one starting with `prefix` (e.g. '007_'), to
 * test what updating an older database does. Rules for functions added by later migrations are left out too.
 */
export async function catalogBefore(prefix: string): Promise<Catalog> {
  const now = await loadCatalog();
  const migrations = now.core.migrations.filter((m) => m.name < prefix);
  let policies = now.core.policies;
  if (prefix <= '010_') policies = policies.replace(', teamhub_notify(uuid[], text, text, uuid)', '');
  return { ...now, core: { ...now.core, migrations, policies, version: migrations.length } };
}
