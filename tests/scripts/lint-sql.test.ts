import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Catalog, CatalogModule } from '../../packages/generator/src/catalog';
import { lintSql } from '../../scripts/lint-sql';

const mod = (id: string, prefix: string, migration: string, policies = '', settings = z.object({})): CatalogModule =>
  ({ manifest: { id, prefix, settings } as never, dir: '', migrations: [{ name: '001_init.sql', sql: migration }], policies, cron: null, readme: '', version: 1 }) as CatalogModule;

const catalog = (...mods: CatalogModule[]): Catalog => ({ root: '', core: { migrations: [], policies: '', cron: '', version: 0 }, modules: new Map(mods.map((m) => [m.manifest.id, m])), integrations: new Map() });

describe('lint-sql', () => {
  it('passes the real catalog rules on clean SQL', () => {
    expect(lintSql(catalog(mod('a', 'aa_', 'create table aa_things (id int);\ncreate index aa_things_idx on aa_things (id);')))).toEqual([]);
  });
  it('flags unprefixed objects, destructive migrations, cross-module refs and definer traps', () => {
    const bad = mod(
      'a',
      'aa_',
      `create table things (id int);
       alter table aa_x drop column y;
       create or replace function aa_f() returns trigger language plpgsql security definer as $$ begin if current_user = 'authenticated' then null; end if; return new; end $$;
       select * from bb_other;`,
      'create policy aa_p on aa_x using ({{settings.nope}} > 0);',
    );
    const msgs = lintSql(catalog(bad, mod('b', 'bb_', 'create table bb_other (id int);'))).map((p) => p.message);
    expect(msgs.some((m) => m.includes('table "things"'))).toBe(true);
    expect(msgs.some((m) => m.includes('DROP COLUMN'))).toBe(true);
    expect(msgs.some((m) => m.includes('bb_other'))).toBe(true);
    expect(msgs.some((m) => m.includes('search_path'))).toBe(true);
    expect(msgs.some((m) => m.includes('current_user'))).toBe(true);
    expect(msgs.some((m) => m.includes('settings.nope'))).toBe(true);
  });
  it('ignores other prefixes inside strings and comments', () => {
    expect(lintSql(catalog(mod('a', 'aa_', "-- see bb_other\ncreate table aa_t (note text default 'bb_other');"), mod('b', 'bb_', 'create table bb_other (id int);')))).toEqual([]);
  });
  it('allows removals only in a migration marked -- teamhub:contract (major releases)', () => {
    expect(lintSql(catalog(mod('a', 'aa_', '-- teamhub:contract (2.0.0: replaced by aa_new)\nalter table aa_x drop column y;')))).toEqual([]);
    expect(lintSql(catalog(mod('a', 'aa_', 'alter table aa_x drop column y; -- teamhub:contract')))).not.toEqual([]);
  });
});
