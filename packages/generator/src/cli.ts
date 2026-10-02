#!/usr/bin/env -S npx tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { ConfigError, configPath, generate, loadCatalog, planSql, planToSql, readConfigFile, REPO_ROOT, resolveConfig } from './index';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const cmd = process.argv[2] ?? 'generate';
  const cfgArg = arg('config');
  const cfgPath = cfgArg ? (isAbsolute(cfgArg) ? cfgArg : join(process.cwd(), cfgArg)) : configPath();
  const config = readConfigFile(cfgPath);

  if (cmd === 'generate') {
    const res = await generate(config);
    console.log(`Done: TeamHub generated for "${config.program.name}"`);
    console.log(`  tabs: ${res.modules.join(', ') || '(core only)'}`);
    if (res.integrations.length) console.log(`  integrations: ${res.integrations.join(', ')}`);
    for (const n of res.themeNotes) console.log(`  note: ${n}`);
    return;
  }
  if (cmd === 'sql') {
    const r = resolveConfig(config, await loadCatalog());
    const plan = planSql(r, null, { cron: !process.argv.includes('--no-cron') });
    const out = join(REPO_ROOT, 'sql', 'plan.sql');
    mkdirSync(join(REPO_ROOT, 'sql'), { recursive: true });
    writeFileSync(out, planToSql(plan));
    console.log(`Wrote ${out}`);
    return;
  }
  console.error(`Unknown command "${cmd}". Use: generate | sql`);
  process.exit(1);
}

main().catch((e) => {
  if (e instanceof ConfigError) {
    console.error(`\nError: ${e.message}`);
  } else {
    console.error(e);
  }
  process.exit(1);
});
