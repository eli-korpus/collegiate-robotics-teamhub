import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { deriveAccent } from '@teamhub/ui/color';
import { MODULE_CATEGORIES } from '@teamhub/config-schema';
import type { Resolved } from './resolve';
import { LAYOUT } from './catalog';

const json = (v: unknown) => JSON.stringify(v, null, 2);
const ident = (id: string) => id.replace(/[^a-zA-Z0-9]/g, '_');

export interface GeneratedFile {
  path: string; // relative to repo root
  content: string;
}

/** Theme tokens from team colors (spec §9.3). */
export function themeCss(r: Resolved): { css: string; adjusted: string[] } {
  const { theme, teams } = r.config;
  const light = deriveAccent(theme.accent, 'light');
  const dark = deriveAccent(theme.accent, 'dark');
  const adjusted: string[] = [];
  if (light.adjusted) adjusted.push(`Accent darkened to ${light.accent} in light mode for contrast`);
  if (dark.adjusted) adjusted.push(`Accent lightened to ${dark.accent} in dark mode for contrast`);
  const sec = theme.secondary ? { l: deriveAccent(theme.secondary, 'light'), d: deriveAccent(theme.secondary, 'dark') } : null;
  const teamVars = (mode: 'light' | 'dark') =>
    teams.map((t) => `  --team-${t.shortCode.toLowerCase()}: ${deriveAccent(t.color, mode).accent};`).join('\n');
  const radius =
    theme.corners === 'sharp'
      ? '  --th-radius-sm: 4px;\n  --th-radius-md: 6px;\n  --th-radius-lg: 8px;'
      : '  --th-radius-sm: 8px;\n  --th-radius-md: 10px;\n  --th-radius-lg: 14px;';
  const block = (a: typeof light, s: typeof light | null, mode: 'light' | 'dark') =>
    [
      `  --accent: ${a.accent};`,
      `  --accent-hover: ${a.hover};`,
      `  --accent-contrast: ${a.contrast};`,
      `  --secondary: ${(s ?? a).accent};`,
      `  --secondary-contrast: ${(s ?? a).contrast};`,
      teamVars(mode),
    ].join('\n');
  const css = `/* Generated from team/teamhub.config.json. Do not edit. */
:root {
${radius}
${block(light, sec?.l ?? null, 'light')}
}
:root.dark {
${block(dark, sec?.d ?? null, 'dark')}
}
`;
  return { css, adjusted };
}

export function generateDashboardFiles(r: Resolved, outDir = 'dashboard/src/generated'): GeneratedFile[] {
  const root = r.catalog.root;
  const abs = join(root, outDir);
  const rel = (p: string) => {
    const x = relative(abs, p).split('\\').join('/');
    return x.startsWith('.') ? x : `./${x}`;
  };
  const active = r.modules.filter((m) => m.state === 'active');
  const c = r.config;
  const files: GeneratedFile[] = [];

  // modules.ts: static imports of ONLY enabled modules (spec P3). Clients lazy-load their routes/widgets.
  // Manifests are inlined as plain data so zod (used by settings schemas) never reaches the browser bundle.
  const mImports = active.map((m, i) => `import c${i} from '${rel(join(m.catalog.dir, 'client.tsx'))}';`).join('\n');
  const meta = (m: (typeof active)[number]) => {
    const x = m.catalog.manifest;
    // Only what the dashboard uses at runtime (keeps the first page load small).
    return { id: x.id, prefix: x.prefix, name: x.name, category: x.category, icon: x.icon, summary: x.summary, purpose: x.purpose, notFor: x.notFor, toolLinkSlots: x.toolLinkSlots, ...(x.viewPerm ? { viewPerm: x.viewPerm } : {}) };
  };
  files.push({
    path: `${outDir}/modules.ts`,
    content: `// Generated. Do not edit.\nimport type { LoadedModule } from '@teamhub/sdk';\n${mImports}\n\nexport const modules: LoadedModule[] = [\n${active
      .map((m, i) => `  { manifest: ${JSON.stringify(meta(m))}, client: c${i} },`)
      .join('\n')}\n];\n`,
  });

  const ixClients = r.activeIntegrations.filter((i) => i.hasClient);
  files.push({
    path: `${outDir}/integrations.ts`,
    content: `// Generated. Do not edit.\nimport type { IntegrationClient } from '@teamhub/sdk';\n${ixClients
      .map((ix, i) => `import i${i} from '${rel(join(ix.dir, existsSync(join(ix.dir, 'client.tsx')) ? 'client.tsx' : 'client.ts'))}';`)
      .join('\n')}\n\nexport const integrations: IntegrationClient[] = [${ixClients.map((_, i) => `i${i}`).join(', ')}];\nexport const integrationIds: string[] = ${json(
      r.activeIntegrations.map((i) => i.manifest.id),
    )};\n`,
  });

  const permissions = Object.fromEntries(Object.entries(r.matrix).sort(([a], [b]) => a.localeCompare(b)));
  files.push({
    path: `${outDir}/permissions.ts`,
    content: `// Generated. Do not edit. Mirrors the compiled teamhub_can() for UI gating only; RLS is the real gate.\nexport const permissions: Record<string, { types: string[]; positions: string[] }> = ${json(permissions)};\n`,
  });

  const order = c.nav.order;
  const sortIdx = (id: string) => (order.includes(id) ? order.indexOf(id) : 1000);
  const nav = MODULE_CATEGORIES.map((cat) => ({
    category: cat,
    items: active
      .filter((m) => m.catalog.manifest.category === cat)
      .sort((a, b) => sortIdx(a.id) - sortIdx(b.id) || a.catalog.manifest.name.localeCompare(b.catalog.manifest.name))
      .map((m) => m.id),
  })).filter((s) => s.items.length);
  files.push({ path: `${outDir}/nav.ts`, content: `// Generated. Do not edit.\nexport const nav: { category: string; items: string[] }[] = ${json(nav)};\n` });

  const expectations = {
    core: r.catalog.core.version,
    modules: Object.fromEntries(r.modules.map((m) => [m.id, m.catalog.version])),
    integrations: Object.fromEntries(r.installedIntegrations.map((i) => [i.manifest.id, i.version])),
  };
  files.push({
    path: `${outDir}/schema-expectations.ts`,
    content: `// Generated. Do not edit.\nexport const schemaExpectations = ${json(expectations)};\n`,
  });

  const runtime = {
    // The TeamHub release this site was built from (root package.json), for the admin "update available" notice.
    version: (JSON.parse(readFileSync(join(r.catalog.root, 'package.json'), 'utf8')) as { version: string }).version,
    program: c.program,
    teams: c.teams,
    theme: c.theme,
    season: c.season,
    subteams: c.subteams,
    positions: c.positions,
    profileFields: c.profileFields,
    home: c.home,
    hosting: c.hosting,
    supabase: { url: c.supabase.url, anonKey: c.supabase.anonKey },
    features: c.features,
    moduleSettings: Object.fromEntries(active.map((m) => [m.id, m.settings])),
    dormantModules: r.modules.filter((m) => m.state === 'dormant').map((m) => m.id),
    installed: r.modules.map((m) => ({ id: m.id, name: m.catalog.manifest.name, prefix: m.catalog.manifest.prefix, state: m.state, buckets: m.catalog.manifest.buckets.map((b) => b.id) })),
  };
  files.push({
    path: `${outDir}/config.ts`,
    content: `// Generated. Do not edit.\nimport type { RuntimeConfig } from '@teamhub/sdk';\nexport const config: RuntimeConfig = ${json(runtime)};\n`,
  });

  files.push({ path: `${outDir}/theme.css`, content: themeCss(r).css });

  const firstLogo = c.program.logo ?? c.teams.find((t) => t.logo)?.logo ?? null;
  // Browsers keep favicons for a long time, so the link carries a version from the file's contents.
  const brandingDir = join(process.env.TEAMHUB_TEAM_DIR ?? join(root, 'team'), 'branding');
  const versioned = (name: string) => {
    const file = join(brandingDir, name);
    return existsSync(file) ? `branding/${name}?v=${createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 8)}` : null;
  };
  files.push({
    path: `${outDir}/html.json`,
    content: json({
      title: c.program.name,
      base: c.hosting.basePath || '/',
      favicon: versioned('favicon.png'),
      appleTouchIcon: versioned('apple-touch-icon.png'),
      logo: firstLogo,
      themeColor: c.theme.accent,
      defaultMode: c.theme.defaultMode,
      spaFallback404: c.hosting.provider === 'github-pages',
    }),
  });
  return files;
}

export function writeFiles(root: string, files: GeneratedFile[], cleanDir?: string): void {
  if (cleanDir) {
    const d = join(root, cleanDir);
    if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  }
  for (const f of files) {
    const p = join(root, f.path);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, f.content);
  }
}

/** Copies team/branding → dashboard/public/branding. */
export function copyBranding(root: string): number {
  const from = join(process.env.TEAMHUB_TEAM_DIR ?? join(root, 'team'), 'branding');
  const to = join(root, LAYOUT.dashboard, 'public', 'branding');
  rmSync(to, { recursive: true, force: true });
  if (!existsSync(from)) return 0;
  mkdirSync(to, { recursive: true });
  let n = 0;
  for (const f of readdirSync(from)) {
    const src = join(from, f);
    if (statSync(src).isFile() && !f.startsWith('.')) {
      copyFileSync(src, join(to, f));
      n++;
    }
  }
  return n;
}

export { ident };
