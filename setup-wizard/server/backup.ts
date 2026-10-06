/**
 * Backup & Export / Import (spec §5.5, §5.6). Exports tables as JSON plus stored files into one zip in
 * ~/TeamHub Backups/<date>/ (outside the repo). Exports always run before a tab is removed.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { createClient } from '@supabase/supabase-js';
import type { Catalog } from '@teamhub/generator';
import type { TeamhubConfig } from '@teamhub/config-schema';
import { lit } from '@teamhub/generator';
import { projectUrl, type Mgmt } from './mgmt';

export const BACKUP_ROOT = process.env.TEAMHUB_BACKUPS ?? join(homedir(), 'TeamHub Backups');

export const CORE_TABLES = ['teamhub_settings', 'profiles', 'profiles_private', 'profiles_leaders', 'memberships', 'positions', 'position_holders', 'subteams', 'links', 'info_requests', 'comments'];

export interface ExportResult {
  path: string;
  tables: Record<string, number>;
  files: number;
  bytes: number;
}

async function tableExists(m: Mgmt, ref: string, t: string) {
  const [r] = await m.query<{ ok: boolean }>(ref, `select to_regclass(${lit(`public.${t}`)}) is not null as ok`);
  return !!r?.ok;
}

export async function exportData(
  m: Mgmt,
  ref: string,
  secretKey: string,
  catalog: Catalog,
  config: TeamhubConfig | null,
  opts: { modules?: string[]; includeCore?: boolean; label?: string } = {},
): Promise<ExportResult> {
  const moduleIds = opts.modules ?? Object.keys(config?.modules ?? {});
  const tables = [...(opts.includeCore === false ? [] : CORE_TABLES)];
  const buckets = new Set<string>(opts.includeCore === false ? [] : ['avatars']);
  for (const id of moduleIds) {
    const cm = catalog.modules.get(id);
    if (!cm) continue;
    tables.push(...cm.manifest.exportTables);
    for (const b of cm.manifest.buckets) buckets.add(b.id);
  }
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const t of tables) {
    if (!(await tableExists(m, ref, t))) continue;
    const [r] = await m.query<{ rows: unknown[] }>(ref, `select coalesce(json_agg(x), '[]'::json) as rows from public.${t} x`);
    data[t] = r?.rows ?? [];
    counts[t] = data[t].length;
  }
  const files: Record<string, Uint8Array> = {};
  let bytes = 0;
  if (buckets.size) {
    const sb = createClient(projectUrl(ref), secretKey, { auth: { persistSession: false } });
    const objects = await m.query<{ bucket_id: string; name: string }>(
      ref,
      `select bucket_id, name from storage.objects where bucket_id in (${[...buckets].map(lit).join(', ')})`,
    );
    for (const o of objects) {
      const { data: blob } = await sb.storage.from(o.bucket_id).download(o.name);
      if (!blob) continue;
      const buf = new Uint8Array(await blob.arrayBuffer());
      files[`files/${o.bucket_id}/${o.name}`] = buf;
      bytes += buf.length;
    }
  }
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const dir = join(BACKUP_ROOT, stamp.slice(0, 10));
  mkdirSync(dir, { recursive: true });
  const name = `${opts.label ?? 'teamhub'}-${stamp}.zip`.replace(/[^\w.-]+/g, '_');
  const manifest = { format: 'teamhub-backup', version: 1, exported_at: new Date().toISOString(), project: ref, modules: moduleIds, config, tables: data };
  const zip = zipSync({ 'data.json': strToU8(JSON.stringify(manifest)), ...files }, { level: 6 });
  const path = join(dir, name);
  writeFileSync(path, zip);
  return { path, tables: counts, files: Object.keys(files).length, bytes };
}

/** Restore a backup into the connected project (rows that already exist are skipped). */
export async function importData(m: Mgmt, ref: string, secretKey: string, zipPath: string) {
  const entries = unzipSync(new Uint8Array(readFileSync(zipPath)));
  const manifest = JSON.parse(strFromU8(entries['data.json']));
  if (manifest.format !== 'teamhub-backup') throw new Error('That file is not a TeamHub backup.');
  const restored: Record<string, number> = {};
  const order = [...CORE_TABLES, ...Object.keys(manifest.tables).filter((t) => !CORE_TABLES.includes(t))];
  for (const t of order) {
    const rows = manifest.tables[t] as unknown[] | undefined;
    if (!rows?.length || !(await tableExists(m, ref, t))) continue;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = JSON.stringify(rows.slice(i, i + 500));
      await m.query(ref, `insert into public.${t} select * from json_populate_recordset(null::public.${t}, ${lit(chunk)}::json) on conflict do nothing`);
    }
    restored[t] = rows.length;
  }
  const sb = createClient(projectUrl(ref), secretKey, { auth: { persistSession: false } });
  let files = 0;
  for (const [k, v] of Object.entries(entries)) {
    if (!k.startsWith('files/') || k.endsWith('/')) continue;
    const [, bucket, ...rest] = k.split('/');
    const { error } = await sb.storage.from(bucket).upload(rest.join('/'), v, { upsert: true });
    if (!error) files++;
  }
  return { restored, files, exportedAt: manifest.exported_at as string };
}

/** Empties and deletes buckets of a deleted tab (SQL cannot delete storage objects). */
export async function deleteBuckets(m: Mgmt, ref: string, secretKey: string, buckets: string[]) {
  if (!buckets.length) return;
  const sb = createClient(projectUrl(ref), secretKey, { auth: { persistSession: false } });
  for (const b of buckets) {
    const objects = await m.query<{ name: string }>(ref, `select name from storage.objects where bucket_id = ${lit(b)}`);
    for (let i = 0; i < objects.length; i += 100) await sb.storage.from(b).remove(objects.slice(i, i + 100).map((o) => o.name));
    await sb.storage.deleteBucket(b);
  }
}
