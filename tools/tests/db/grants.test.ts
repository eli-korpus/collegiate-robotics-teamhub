import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SUPABASE_STUB, TEAM_A, TestDb, withModules } from './harness';

const ALL = Object.keys(JSON.parse(readFileSync('tools/examples/demo.config.json', 'utf8')).modules);

/**
 * Supabase projects can turn off "Automatically expose new tables" (Supabase recommends it). TeamHub must then grant
 * access itself. This simulates that setting by removing the default privileges from the Supabase stub.
 */
describe('works with "Automatically expose new tables" turned off', () => {
  it('members can use tables, signed-out visitors can only ping, internal helpers stay locked', async () => {
    const stub = SUPABASE_STUB.split('\n').filter((l) => !l.startsWith('alter default privileges')).join('\n');
    const pg = new PGlite();
    await pg.exec(stub);
    // Also drop PUBLIC's default function access, as some Supabase setups do.
    await pg.exec('alter default privileges in schema public revoke execute on functions from public;');
    const db = new TestDb(pg);
    await db.applyConfig(withModules(ALL), true);
    const m = await db.user('Mentor', { [TEAM_A]: 'mentor' });
    await db.as(m, `insert into task_items (team_id, title, created_by) values ($1, 'Works', $2)`, [TEAM_A, m]);
    expect((await db.as(m, 'select title from task_items'))[0].title).toBe('Works');
    expect((await db.as(m, `select teamhub_can('tasks.create', $1) ok`, [TEAM_A]))[0].ok).toBe(true);
    await db.as(null, 'select teamhub_ping()');
    await expect(db.as(null, 'select * from task_items')).rejects.toThrow();
    await expect(db.as(m, `select teamhub_notify(array[$1]::uuid[], 'x', 'y')`, [m])).rejects.toThrow();
    await expect(db.as(m, `select cal_ical('x')`)).rejects.toThrow();
    await expect(db.as(m, 'select poll_finalize()')).rejects.toThrow();
  }, 120_000);
});

describe('every table is protected (all tabs on)', () => {
  it('has row-level security, at least one rule, and nothing for signed-out visitors', async () => {
    const pg = new PGlite();
    await pg.exec(SUPABASE_STUB);
    const db = new TestDb(pg);
    await db.applyConfig(withModules(ALL), true);
    const tables = await db.admin(`
      select c.relname name, c.relrowsecurity rls,
        (select count(*)::int from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) policies
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' order by 1`);
    expect(tables.length).toBeGreaterThan(40);
    // Tables only definer functions touch may have no rules at all (RLS on = closed to everyone else).
    expect(tables.filter((t) => !t.rls).map((t) => t.name)).toEqual([]);
    const ruleless = tables.filter((t) => t.policies === 0).map((t) => t.name);
    const definerOnly = ['teamhub_storage_trash', 'att_codes', 'att_attempts'];
    expect(ruleless.filter((n) => !definerOnly.includes(n)), 'tables with RLS on but no rules: add rules or list them as definer-only').toEqual([]);
    for (const t of tables) await expect(db.as(null, `select 1 from public.${t.name} limit 1`), t.name).rejects.toThrow();
  }, 180_000);
});
