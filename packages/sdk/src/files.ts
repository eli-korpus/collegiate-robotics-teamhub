// Storage helpers live apart from hooks.ts so the gzip/download code in @teamhub/ui stays out of the first page load.
import { downloadBlob, gunzipBlob, type ProcessedFile } from '@teamhub/ui';
import { getSupabase } from './runtime';

/** `<team_id|program>/<entity_id>/<uuid>.<ext>` (spec §11.2). */
export function storagePath(teamId: string | null, entityId: string | number, fileName: string): string {
  const ext = fileName.includes('.') ? fileName.slice(fileName.indexOf('.') + 1).toLowerCase() : 'bin';
  return `${teamId ?? 'program'}/${entityId}/${crypto.randomUUID()}.${ext}`;
}

export async function uploadFile(bucket: string, path: string, f: ProcessedFile): Promise<string> {
  const { error } = await getSupabase().storage.from(bucket).upload(path, f.blob, { contentType: f.contentType, upsert: false });
  if (error) throw error;
  return path;
}

/** Downloads a stored file; transparently un-gzips files stored as `.gz` (spec §11.2). */
export async function downloadFile(bucket: string, path: string, name: string) {
  const { data, error } = await getSupabase().storage.from(bucket).download(path);
  if (error) throw error;
  const isGz = path.endsWith('.gz') || name.endsWith('.gz');
  const blob = isGz ? await gunzipBlob(data) : data;
  downloadBlob(blob, name.replace(/\.gz$/, ''));
}
