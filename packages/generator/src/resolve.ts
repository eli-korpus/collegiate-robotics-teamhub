import type { PermissionGrant, TeamhubConfig } from '@teamhub/config-schema';
import { allCorePermissions, modulePermissions, type PermissionDefs } from '@teamhub/sdk/define';
import type { Catalog, CatalogIntegration, CatalogModule } from './catalog';

export interface ResolvedModule {
  id: string;
  state: 'active' | 'dormant';
  settings: Record<string, unknown>;
  catalog: CatalogModule;
  permissions: PermissionDefs;
}

export interface Resolved {
  config: TeamhubConfig;
  catalog: Catalog;
  /** Installed modules (active + dormant), sorted by id. */
  modules: ResolvedModule[];
  /** Integrations whose required modules are all installed. */
  installedIntegrations: CatalogIntegration[];
  /** Integrations whose required modules are all active (rendered in the UI). */
  activeIntegrations: CatalogIntegration[];
  /** Every permission definition (core + active modules). */
  permissionDefs: PermissionDefs;
  /** Final matrix: config overrides + defaults for anything missing. */
  matrix: Record<string, PermissionGrant>;
  errors: string[];
}

export function resolveConfig(config: TeamhubConfig, catalog: Catalog): Resolved {
  const errors: string[] = [];
  const modules: ResolvedModule[] = [];
  for (const [id, entry] of Object.entries(config.modules).sort(([a], [b]) => a.localeCompare(b))) {
    const cm = catalog.modules.get(id);
    if (!cm) {
      errors.push(`Unknown module "${id}" in config`);
      continue;
    }
    const parsed = cm.manifest.settings.safeParse(entry.settings ?? {});
    if (!parsed.success) {
      errors.push(`${id} settings: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      continue;
    }
    const settings = parsed.data as Record<string, unknown>;
    modules.push({ id, state: entry.state, settings, catalog: cm, permissions: modulePermissions(cm.manifest, settings, config) });
  }
  const installed = new Set(modules.map((m) => m.id));
  const active = new Set(modules.filter((m) => m.state === 'active').map((m) => m.id));
  const integrations = [...catalog.integrations.values()];
  const installedIntegrations = integrations.filter((i) => i.manifest.requires.every((r) => installed.has(r)));
  const activeIntegrations = integrations.filter((i) => i.manifest.requires.every((r) => active.has(r)));

  const permissionDefs: PermissionDefs = { ...allCorePermissions };
  for (const m of modules) if (m.state === 'active') Object.assign(permissionDefs, m.permissions);

  const positionIds = new Set(config.positions.map((p) => p.id));
  const matrix: Record<string, PermissionGrant> = {};
  for (const [key, def] of Object.entries(permissionDefs)) {
    const fromConfig = config.permissions[key];
    matrix[key] = fromConfig
      ? { types: [...fromConfig.types], positions: fromConfig.positions.filter((p) => positionIds.has(p)) }
      : { types: [...def.default], positions: (def.positions ?? []).filter((p) => positionIds.has(p)) };
  }
  return { config, catalog, modules, installedIntegrations, activeIntegrations, permissionDefs, matrix, errors };
}

/** Builds a default permission matrix for the wizard (all defaults). */
export function defaultMatrix(defs: PermissionDefs, positionIds: Set<string>): Record<string, PermissionGrant> {
  const out: Record<string, PermissionGrant> = {};
  for (const [k, d] of Object.entries(defs)) {
    out[k] = { types: [...d.default], positions: (d.positions ?? []).filter((p) => positionIds.has(p)) };
  }
  return out;
}
