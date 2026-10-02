/**
 * SQL linter for module and integration SQL (spec §16). Run by `npm run lint`.
 *  - every object a module/integration creates (table, function, trigger, policy, index, view, type, cron job) starts
 *    with its prefix, so dormant/delete can find it by prefix
 *  - migrations are expand-only (no DROP TABLE/COLUMN, RENAME, or column type changes), except a migration that starts
 *    with `-- teamhub:contract`, which only major releases may ship (docs/releasing.md)
 *  - modules never reference another module's tables; integrations only their two modules'
 *  - security definer functions pin search_path and never test current_user (it is the owner inside them)
 *  - {{settings.x}} placeholders exist in the module's settings schema and only appear in policies.sql / cron.sql
 */
import { pathToFileURL } from 'node:url';
import { loadCatalog, type Catalog } from '../packages/generator/src/catalog';

export interface SqlProblem {
  where: string;
  message: string;
}

const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** Removes $$-quoted bodies' string literals so words inside messages don't trip the cross-module check. */
const stripStrings = (sql: string) => sql.replace(/'(?:[^']|'')*'/g, "''");

const CREATE = /\bcreate\s+(?:or\s+replace\s+)?(?:unique\s+)?(table|function|trigger|policy|index|view|type|materialized\s+view)\s+(?:if\s+not\s+exists\s+)?(?:public\.)?("?[\w]+"?)/gi;
const CRON = /cron\.schedule\(\s*'([^']+)'/gi;
const SETTING = /\{\{settings\.(\w+)\}\}/g;

function functionBodies(sql: string): { name: string; header: string; body: string }[] {
  const out: { name: string; header: string; body: string }[] = [];
  const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\$\$([\s\S]*?)\$\$/gi;
  for (const m of sql.matchAll(re)) out.push({ name: m[1], header: m[2], body: m[3] });
  return out;
}

export function lintSql(catalog: Catalog): SqlProblem[] {
  const problems: SqlProblem[] = [];
  const prefixes = new Map<string, string>();
  for (const [id, m] of catalog.modules) if (m.manifest.prefix) prefixes.set(m.manifest.prefix, id);

  const check = (where: string, sql: string, own: string[], allowed: Set<string>, opts: { migration: boolean; settings?: Set<string>; templated: boolean }) => {
    const clean = stripComments(sql);
    for (const m of clean.matchAll(CREATE)) {
      const kind = m[1].toLowerCase();
      const name = m[2].replace(/"/g, '');
      if (!own.some((p) => name.startsWith(p))) problems.push({ where, message: `${kind} "${name}" must start with ${own.join(' or ')}` });
    }
    for (const m of clean.matchAll(CRON)) if (!own.some((p) => m[1].startsWith(p))) problems.push({ where, message: `cron job "${m[1]}" must start with ${own.join(' or ')}` });
    // Major versions may remove things in a migration that starts with "-- teamhub:contract" (docs/releasing.md).
    const contract = opts.migration && /^\s*-- teamhub:contract\b/.test(sql);
    if (opts.migration && !contract) {
      if (/\bdrop\s+table\b/i.test(clean)) problems.push({ where, message: 'migrations are expand-only: no DROP TABLE (teardown is generated from the prefix)' });
      if (/\bdrop\s+column\b/i.test(clean)) problems.push({ where, message: 'migrations are expand-only: no DROP COLUMN' });
      if (/\brename\s+(?:column\s+)?\w+\s+to\b|\brename\s+to\b/i.test(clean)) problems.push({ where, message: 'migrations are expand-only: no RENAME' });
      if (/\balter\s+column\s+\w+\s+(?:set\s+data\s+)?type\b/i.test(clean)) problems.push({ where, message: 'migrations are expand-only: no column type changes' });
    }
    // Cross-module references (outside string literals).
    const words = stripStrings(clean);
    for (const [prefix, owner] of prefixes) {
      if (allowed.has(prefix)) continue;
      const hit = new RegExp(`(?<![\\w.])${prefix}[a-z]\\w*`, 'i').exec(words);
      if (hit) problems.push({ where, message: `references "${hit[0]}" from module "${owner}" — use an integration unit instead` });
    }
    for (const f of functionBodies(clean)) {
      if (/\bsecurity\s+definer\b/i.test(f.header)) {
        if (!/\bset\s+search_path\b/i.test(f.header)) problems.push({ where, message: `security definer function ${f.name} must "set search_path = public"` });
        if (/\bcurrent_user\b/i.test(f.body)) problems.push({ where, message: `security definer function ${f.name} tests current_user, which is always the owner inside it — drop "security definer"` });
      }
    }
    for (const m of sql.matchAll(SETTING)) {
      if (!opts.templated) problems.push({ where, message: `{{settings.${m[1]}}} only works in policies.sql and cron.sql (re-applied on every plan)` });
      else if (opts.settings && !opts.settings.has(m[1])) problems.push({ where, message: `{{settings.${m[1]}}} is not a setting of this module` });
    }
  };

  for (const [id, m] of catalog.modules) {
    const own = m.manifest.prefix ? [m.manifest.prefix] : [];
    if (!own.length) continue;
    const shape = (m.manifest.settings as unknown as { shape?: Record<string, unknown> }).shape;
    const settings = new Set(Object.keys(shape ?? {}));
    const allowed = new Set(own);
    for (const f of m.migrations) check(`modules/${id}/migrations/${f.name}`, f.sql, own, allowed, { migration: true, templated: false });
    check(`modules/${id}/policies.sql`, m.policies, own, allowed, { migration: false, settings, templated: true });
    if (m.cron) check(`modules/${id}/cron.sql`, m.cron, own, allowed, { migration: false, settings, templated: true });
  }
  for (const [id, ix] of catalog.integrations) {
    const own = [ix.manifest.prefix];
    const allowed = new Set([ix.manifest.prefix, ...ix.manifest.requires.map((r) => catalog.modules.get(r)?.manifest.prefix).filter((p): p is string => !!p)]);
    for (const f of ix.migrations) check(`integrations/${id}/migrations/${f.name}`, f.sql, own, allowed, { migration: true, templated: false });
    if (ix.policies.trim()) check(`integrations/${id}/policies.sql`, ix.policies, own, allowed, { migration: false, templated: false });
    if (ix.manifest.down.trim()) check(`integrations/${id} down`, ix.manifest.down, own, allowed, { migration: false, templated: false });
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = lintSql(await loadCatalog());
  for (const p of problems) console.error(`error ${p.where}: ${p.message}`);
  if (problems.length) {
    console.error(`\n${problems.length} SQL problem${problems.length === 1 ? '' : 's'}`);
    process.exit(1);
  }
  console.log('SQL lint passed');
}
