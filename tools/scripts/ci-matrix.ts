/**
 * Module matrix (spec §16.1): proves "any combination of tabs works".
 * Configs: core only, each module alone, all modules, and N seeded random subsets (the seed is logged so a failing
 * subset can be reproduced). For each config: generate → typecheck → build → apply SQL to PGlite (fresh + re-apply)
 * → bundle budget / zero-byte check → optional Playwright smoke.
 *
 *   npm run ci:matrix                                  # everything
 *   npm run ci:matrix -- --only core,all --smoke       # a quick pass with smoke tests
 *   npm run ci:matrix -- --only random --seed 1234 --count 3
 *   npm run ci:matrix -- --only singles --shard 2/4    # CI shards the 28 single-module builds
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseConfig, type TeamhubConfig } from '@teamhub/config-schema';
import { generate, loadCatalog, REPO_ROOT } from '@teamhub/generator';
import { createTestDb } from '../tests/db/harness';
import { checkBundle } from './check-bundle';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const only = new Set((arg('only') ?? 'core,singles,all,random').split(','));
const seed = Number(arg('seed') ?? Math.floor(Math.random() * 1e6));
const count = Number(arg('count') ?? 10);
const smoke = process.argv.includes('--smoke');
const skipTypecheck = process.argv.includes('--no-typecheck');
const [shardN, shardOf] = (arg('shard') ?? '1/1').split('/').map(Number);

const ALL = readdirSync(join(REPO_ROOT, 'tabs')).filter((d) => !d.startsWith('.') && d !== 'integrations').sort();
const base = JSON.parse(readFileSync(join(REPO_ROOT, 'tools/examples/demo.config.json'), 'utf8'));

/** Mulberry32: tiny seeded PRNG so random subsets are reproducible from the logged seed. */
function rng(s: number) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function configFor(ids: string[]): TeamhubConfig {
  const parsed = parseConfig({ ...base, modules: Object.fromEntries(ids.map((id) => [id, { state: 'active', settings: base.modules[id]?.settings ?? {} }])) });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.config;
}

const matrix: { name: string; ids: string[] }[] = [];
if (only.has('core')) matrix.push({ name: 'core-only', ids: [] });
if (only.has('singles')) ALL.filter((_, i) => i % shardOf === shardN - 1).forEach((id) => matrix.push({ name: `only:${id}`, ids: [id] }));
if (only.has('all')) matrix.push({ name: 'all', ids: ALL });
if (only.has('random')) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const ids = ALL.filter(() => r() < 0.4);
    matrix.push({ name: `random#${i + 1}(seed ${seed})`, ids });
  }
  console.log(`Random subsets use seed ${seed}. Reproduce with: npm run ci:matrix -- --only random --seed ${seed} --count ${count}`);
}

const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { cwd: REPO_ROOT, stdio: 'pipe', encoding: 'utf8', env: { ...process.env, CI: '1' } });

const results: { name: string; ok: boolean; step?: string; detail?: string; kb?: number }[] = [];
const catalog = await loadCatalog();
for (const m of matrix) {
  const started = Date.now();
  let step = 'generate';
  try {
    const config = configFor(m.ids);
    await generate(config, catalog);
    if (!skipTypecheck) {
      step = 'typecheck';
      run('npx', ['tsc', '-p', 'tsconfig.json']);
    }
    step = 'build';
    run('npm', ['run', 'build', '-w', '@teamhub/dashboard']);
    step = 'sql';
    const db = await createTestDb();
    await db.applyConfig(config, true, catalog);
    await db.applyConfig(config, false, catalog);
    await db.pg.close();
    step = 'bundle';
    const b = checkBundle(m.ids, ALL);
    if (b.problems.length) throw new Error(b.problems.join('; '));
    if (smoke) {
      step = 'smoke';
      run('npx', ['playwright', 'test', '--config', 'tools/playwright.config.ts', 'tools/tests/e2e/smoke.spec.ts', '--project=desktop', '--reporter=line']);
    }
    results.push({ name: m.name, ok: true, kb: b.initial / 1024 });
    console.log(`ok    ${m.name.padEnd(36)} ${(b.initial / 1024).toFixed(1).padStart(6)} KB  ${((Date.now() - started) / 1000).toFixed(0)}s  [${m.ids.join(', ') || 'core'}]`);
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string };
    const detail = (err.stdout || '') + (err.stderr || '') || err.message;
    results.push({ name: m.name, ok: false, step, detail });
    console.error(`FAIL  ${m.name} failed at ${step} [${m.ids.join(', ') || 'core'}]\n${detail.split('\n').slice(-25).join('\n')}`);
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} configs passed`);
process.exit(failed.length ? 1 : 0);
