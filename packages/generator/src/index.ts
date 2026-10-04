import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseConfig, type TeamhubConfig } from '@teamhub/config-schema';
import { loadCatalog, REPO_ROOT, type Catalog } from './catalog';
import { copyBranding, generateDashboardFiles, themeCss, writeFiles } from './codegen';
import { resolveConfig } from './resolve';

export * from './catalog';
export * from './resolve';
export * from './sql';
export * from './codegen';
export * from './diff';

export const DEFAULT_CONFIG_PATH = 'team/teamhub.config.json';

export class ConfigError extends Error {}

export function readConfigFile(path: string): TeamhubConfig {
  if (!existsSync(path)) {
    throw new ConfigError(
      `No TeamHub config found at ${path}.\n\n  Run \`npm run setup\` to create one with the setup wizard,\n  or try the demo with \`npm run dev:demo\`.\n`,
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new ConfigError(`${path} is not valid JSON: ${(e as Error).message}`);
  }
  const parsed = parseConfig(raw);
  if (!parsed.ok) {
    throw new ConfigError(`${path} has problems:\n${parsed.issues.map((i) => `  • ${i.path || '(root)'}: ${i.message}`).join('\n')}`);
  }
  return parsed.config;
}

export interface GenerateResult {
  modules: string[];
  integrations: string[];
  themeNotes: string[];
  brandingFiles: number;
}

/** `teamhub generate`: config → dashboard/src/generated + branding (spec §3.3). */
export async function generate(config: TeamhubConfig, catalog?: Catalog, root = REPO_ROOT): Promise<GenerateResult> {
  const cat = catalog ?? (await loadCatalog(root));
  const r = resolveConfig(config, cat);
  if (r.errors.length) throw new ConfigError(`Config problems:\n${r.errors.map((e) => `  • ${e}`).join('\n')}`);
  const files = generateDashboardFiles(r);
  writeFiles(root, files, 'dashboard/src/generated');
  const brandingFiles = copyBranding(root);
  return {
    modules: r.modules.filter((m) => m.state === 'active').map((m) => m.id),
    integrations: r.activeIntegrations.map((i) => i.manifest.id),
    themeNotes: themeCss(r).adjusted,
    brandingFiles,
  };
}

/** team/ folder (overridable for tests with TEAMHUB_TEAM_DIR). */
export function teamDir(root = REPO_ROOT): string {
  return process.env.TEAMHUB_TEAM_DIR ?? join(root, 'team');
}

export function configPath(root = REPO_ROOT): string {
  return join(teamDir(root), 'teamhub.config.json');
}
export * from './release';
