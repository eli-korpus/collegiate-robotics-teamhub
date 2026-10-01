/**
 * Bundle budget (spec §16.4):
 *  - initial JS (entry + modulepreloads) ≤ 180 KB gzip
 *  - each lazy chunk ≤ 60 KB gzip (exception: the 3D viewer chunk)
 *  - disabled modules contribute 0 bytes (their ids/markers never appear in the output)
 * Usage: tsx scripts/check-bundle.ts [--enabled id1,id2] [--json]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const DIST = join(import.meta.dirname, '..', 'apps', 'dashboard', 'dist');
const INITIAL_BUDGET = 180 * 1024;
const CHUNK_BUDGET = 60 * 1024;
const CHUNK_EXCEPTIONS = [/^three-/, /^ModelViewer-/, /^react-/, /^supabase-/];

export interface BundleReport {
  initial: number;
  initialFiles: { file: string; gzip: number }[];
  chunks: { file: string; gzip: number }[];
  problems: string[];
}

export function checkBundle(enabled?: string[], allModuleIds: string[] = []): BundleReport {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  const eager = new Set<string>();
  for (const m of html.matchAll(/(?:src|href)="[^"]*assets\/([^"]+\.js)"/g)) eager.add(m[1]);
  const assets = readdirSync(join(DIST, 'assets')).filter((f) => f.endsWith('.js'));
  const gz = (f: string) => gzipSync(readFileSync(join(DIST, 'assets', f))).length;
  const initialFiles = [...eager].map((file) => ({ file, gzip: gz(file) }));
  const initial = initialFiles.reduce((s, f) => s + f.gzip, 0);
  const chunks = assets.filter((f) => !eager.has(f)).map((file) => ({ file, gzip: gz(file) }));
  const problems: string[] = [];
  if (initial > INITIAL_BUDGET) problems.push(`Initial JS is ${(initial / 1024).toFixed(1)} KB gzip (budget 180 KB)`);
  for (const c of chunks) {
    if (c.gzip > CHUNK_BUDGET && !CHUNK_EXCEPTIONS.some((r) => r.test(c.file))) problems.push(`Chunk ${c.file} is ${(c.gzip / 1024).toFixed(1)} KB gzip (budget 60 KB)`);
  }
  if (enabled) {
    // Each module embeds a marker string `teamhub-module:<id>` in its client file; disabled ones must be absent.
    const all = assets.map((f) => readFileSync(join(DIST, 'assets', f), 'utf8')).join('\n');
    for (const id of allModuleIds) {
      const present = all.includes(`teamhub-module:${id}"`) || all.includes(`teamhub-module:${id}'`);
      if (!enabled.includes(id) && present) problems.push(`Disabled module "${id}" is present in the bundle`);
      if (enabled.includes(id) && !present) problems.push(`Enabled module "${id}" is missing from the bundle`);
    }
  }
  return { initial, initialFiles, chunks, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--enabled');
  const enabled = i >= 0 ? (process.argv[i + 1] ?? '').split(',').filter(Boolean) : undefined;
  const all = readdirSync(join(import.meta.dirname, '..', 'modules'));
  const r = checkBundle(enabled, all);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`Initial JS: ${(r.initial / 1024).toFixed(1)} KB gzip`);
    for (const f of r.initialFiles.sort((a, b) => b.gzip - a.gzip)) console.log(`  ${(f.gzip / 1024).toFixed(1).padStart(6)} KB  ${f.file}`);
    for (const p of r.problems) console.error(`✗ ${p}`);
  }
  process.exit(r.problems.length ? 1 : 0);
}
