// Daily storage cleanup (spec §11.2). Postgres cannot delete storage objects, so triggers and cron jobs enqueue
// paths into teamhub_storage_trash and this function removes them. Called by pg_cron + pg_net with a shared secret.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const secret = Deno.env.get('TEAMHUB_CLEANUP_SECRET');
  if (!secret || req.headers.get('x-teamhub-secret') !== secret) return new Response('Forbidden', { status: 403 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  let removed = 0;
  for (let round = 0; round < 20; round++) {
    const { data: rows, error } = await admin.from('teamhub_storage_trash').select('id, bucket, path').order('id').limit(500);
    if (error) return new Response(error.message, { status: 500 });
    if (!rows?.length) break;
    const byBucket = new Map<string, { ids: number[]; paths: string[] }>();
    for (const r of rows) {
      const e = byBucket.get(r.bucket) ?? { ids: [], paths: [] };
      e.ids.push(r.id);
      e.paths.push(r.path);
      byBucket.set(r.bucket, e);
    }
    for (const [bucket, { ids, paths }] of byBucket) {
      // Folders (paths ending in /) are expanded to their files first.
      const files: string[] = [];
      for (const p of paths) {
        if (p.endsWith('/')) {
          const { data } = await admin.storage.from(bucket).list(p.slice(0, -1), { limit: 1000 });
          for (const f of data ?? []) files.push(`${p}${f.name}`);
        } else files.push(p);
      }
      for (let i = 0; i < files.length; i += 100) await admin.storage.from(bucket).remove(files.slice(i, i + 100));
      removed += files.length;
      await admin.from('teamhub_storage_trash').delete().in('id', ids);
    }
  }
  return new Response(JSON.stringify({ removed }), { headers: { 'Content-Type': 'application/json' } });
});
