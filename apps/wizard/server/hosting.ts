/** Host config files written into the team's fork (spec §6.1). Upstream never owns these files. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '@teamhub/generator';
import type { HostProvider } from '@teamhub/config-schema';
import { TEAMHUB_UPSTREAM_REPO } from '@teamhub/config-schema/util';

export interface HostFile {
  path: string;
  content: string;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'teamhub';

export function hostFiles(provider: HostProvider, programName: string, branch = 'main'): HostFile[] {
  switch (provider) {
    case 'cloudflare':
      return [
        {
          path: 'wrangler.jsonc',
          content: `// Cloudflare Workers static assets (written by the TeamHub setup wizard).
// Build command: npm run build · Deploy command: npx wrangler deploy
{
  "name": "${slug(programName)}-teamhub",
  "compatibility_date": "2026-09-01",
  "assets": {
    "directory": "./apps/dashboard/dist",
    "not_found_handling": "single-page-application"
  }
}
`,
        },
      ];
    case 'vercel':
      return [
        {
          path: 'vercel.json',
          content: `${JSON.stringify(
            { buildCommand: 'npm run build', outputDirectory: 'apps/dashboard/dist', framework: null, rewrites: [{ source: '/(.*)', destination: '/index.html' }] },
            null,
            2,
          )}\n`,
        },
      ];
    case 'netlify':
      return [
        {
          path: 'netlify.toml',
          content: `# Written by the TeamHub setup wizard.
[build]
  command = "npm run build"
  publish = "apps/dashboard/dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`,
        },
      ];
    case 'github-pages':
      return [
        {
          path: '.github/workflows/pages.yml',
          content: readFileSync(join(REPO_ROOT, '.github/workflows/pages.yml.template'), 'utf8').replace('__BRANCH__', branch),
        },
      ];
  }
}

/** Weekly "is there a new TeamHub release?" check that opens an issue in the fork (docs/updating.md). */
export function updatesWorkflowFile(): HostFile {
  return {
    path: '.github/workflows/teamhub-updates.yml',
    content: readFileSync(join(REPO_ROOT, '.github/workflows/teamhub-updates.yml.template'), 'utf8').replace('__UPSTREAM__', TEAMHUB_UPSTREAM_REPO),
  };
}

export function keepaliveFile(): HostFile {
  return { path: '.github/workflows/keepalive.yml', content: readFileSync(join(REPO_ROOT, '.github/workflows/keepalive.yml.template'), 'utf8') };
}

export function writeHostFiles(files: HostFile[]): string[] {
  for (const f of files) {
    const p = join(REPO_ROOT, f.path);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, f.content);
  }
  return files.map((f) => f.path);
}

export const HOST_OWNED_PATHS = ['wrangler.jsonc', 'vercel.json', 'netlify.toml', '.github/workflows/pages.yml', '.github/workflows/keepalive.yml', '.github/workflows/teamhub-updates.yml'];
export const existingHostPaths = () => HOST_OWNED_PATHS.filter((p) => existsSync(join(REPO_ROOT, p)));

/** Checks a deployed site responds and looks like TeamHub. */
export async function checkSite(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return { ok: false, message: `The site answered with HTTP ${res.status}. Is the deploy finished?` };
    const html = await res.text();
    if (!html.includes('id="root"')) return { ok: false, message: 'The page loaded but does not look like TeamHub yet. Check the output directory is apps/dashboard/dist.' };
    const deep = await fetch(new URL('people', url.endsWith('/') ? url : `${url}/`), { redirect: 'follow' });
    if (!deep.ok) return { ok: false, message: 'Home works but sub-pages return an error: the SPA fallback (rewrite to index.html) is missing.' };
    return { ok: true, message: 'Your site is live!' };
  } catch (e) {
    return { ok: false, message: `Could not reach ${url}: ${(e as Error).message}` };
  }
}
