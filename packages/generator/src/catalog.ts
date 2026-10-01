import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { IntegrationManifest, ModuleManifest } from '@teamhub/sdk/define';

export interface SqlFile {
  name: string;
  sql: string;
}

export interface CatalogModule {
  manifest: ModuleManifest;
  dir: string;
  migrations: SqlFile[];
  policies: string;
  cron: string | null;
  readme: string;
  version: number;
}

export interface CatalogIntegration {
  manifest: IntegrationManifest;
  dir: string;
  migrations: SqlFile[];
  policies: string;
  hasClient: boolean;
  version: number;
}

export interface Catalog {
  root: string;
  core: { migrations: SqlFile[]; policies: string; cron: string; version: number };
  modules: Map<string, CatalogModule>;
  integrations: Map<string, CatalogIntegration>;
}

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const readIf = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

function readMigrations(dir: string): SqlFile[] {
  const mdir = join(dir, 'migrations');
  if (!existsSync(mdir)) return [];
  const files = readdirSync(mdir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort();
  files.forEach((f, i) => {
    if (Number(f.slice(0, 3)) !== i + 1) throw new Error(`${mdir}: migrations must be numbered 001, 002, … without gaps (found ${f})`);
  });
  return files.map((f) => ({ name: f, sql: readFileSync(join(mdir, f), 'utf8') }));
}

let cached: Promise<Catalog> | null = null;

/** Loads every module and integration in the repo (manifests are imported, SQL read from disk). */
export function loadCatalog(root = REPO_ROOT): Promise<Catalog> {
  if (root === REPO_ROOT && cached) return cached;
  const p = doLoad(root);
  if (root === REPO_ROOT) cached = p;
  return p;
}

async function doLoad(root: string): Promise<Catalog> {
  const coreDir = join(root, 'core');
  const coreMigrations = readMigrations(coreDir);
  const core = {
    migrations: coreMigrations,
    policies: readFileSync(join(coreDir, 'policies.sql'), 'utf8'),
    cron: readIf(join(coreDir, 'cron.sql')) ?? '',
    version: coreMigrations.length,
  };

  const modules = new Map<string, CatalogModule>();
  const mroot = join(root, 'modules');
  for (const id of existsSync(mroot) ? readdirSync(mroot).sort() : []) {
    const dir = join(mroot, id);
    const manifestPath = join(dir, 'module.ts');
    if (!existsSync(manifestPath)) continue;
    const mod = await import(pathToFileURL(manifestPath).href);
    const manifest: ModuleManifest = mod.default;
    if (manifest.id !== id) throw new Error(`modules/${id}/module.ts declares id "${manifest.id}"`);
    const migrations = readMigrations(dir);
    modules.set(id, {
      manifest,
      dir,
      migrations,
      policies: readIf(join(dir, 'policies.sql')) ?? '',
      cron: readIf(join(dir, 'cron.sql')),
      readme: readIf(join(dir, 'README.md')) ?? '',
      version: migrations.length,
    });
  }

  const integrations = new Map<string, CatalogIntegration>();
  const iroot = join(root, 'integrations');
  for (const id of existsSync(iroot) ? readdirSync(iroot).sort() : []) {
    const dir = join(iroot, id);
    const manifestPath = join(dir, 'integration.ts');
    if (!existsSync(manifestPath)) continue;
    const mod = await import(pathToFileURL(manifestPath).href);
    const manifest: IntegrationManifest = mod.default;
    if (manifest.id !== id) throw new Error(`integrations/${id}/integration.ts declares id "${manifest.id}"`);
    const migrations = readMigrations(dir);
    integrations.set(id, {
      manifest,
      dir,
      migrations,
      policies: readIf(join(dir, 'policies.sql')) ?? '',
      hasClient: existsSync(join(dir, 'client.tsx')) || existsSync(join(dir, 'client.ts')),
      version: migrations.length,
    });
  }

  validateCatalog({ root, core, modules, integrations });
  return { root, core, modules, integrations };
}

export function validateCatalog(c: Catalog): void {
  const prefixes = new Map<string, string>();
  for (const [id, m] of c.modules) {
    const man = m.manifest;
    if (man.prefix) {
      if (!/^[a-z]+_$/.test(man.prefix)) throw new Error(`${id}: prefix must look like "abc_"`);
      const other = prefixes.get(man.prefix);
      if (other) throw new Error(`Prefix ${man.prefix} used by both ${other} and ${id}`);
      prefixes.set(man.prefix, id);
    }
    for (const key of Object.keys(man.permissions)) {
      if (!key.startsWith(`${id}.`)) throw new Error(`${id}: permission "${key}" must start with "${id}."`);
    }
    if (!man.purpose || !man.notFor) throw new Error(`${id}: purpose and notFor are required (spec P6)`);
    for (const b of man.buckets) {
      if (!man.permissions[b.uploadPerm] && !man.dynamicPermissions)
        throw new Error(`${id}: bucket ${b.id} uses unknown permission ${b.uploadPerm}`);
    }
  }
  for (const [id, i] of c.integrations) {
    for (const r of i.manifest.requires) {
      if (!c.modules.has(r)) throw new Error(`integration ${id} requires unknown module ${r}`);
    }
    if (!/^ix_[a-z]+_$/.test(i.manifest.prefix)) throw new Error(`integration ${id}: prefix must look like "ix_abc_"`);
  }
}
