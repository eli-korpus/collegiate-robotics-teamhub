-- Auto-delete model files {{settings.autoDeleteDays}} days after a job is finished, unless "keep files" (spec §13.13).
-- Deleting mfg_files rows queues the stored objects for the cleanup function (trigger mfg_files_cleanup).
select cron.schedule('mfg_auto_delete_files', '41 3 * * *', $$
  delete from public.mfg_files f using public.mfg_jobs j
  where j.id = f.job_id and not j.keep_files and j.status in ('done', 'failed', 'cancelled')
    and coalesce(j.done_at, j.created_at) < now() - interval '{{settings.autoDeleteDays}} days'
$$);
