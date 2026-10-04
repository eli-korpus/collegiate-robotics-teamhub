-- Core scheduled jobs (pg_cron). Job names start with teamhub_ so they can be managed precisely.
select cron.schedule('teamhub_prune_notifications', '17 3 * * *', $$
  delete from public.notifications
  where (read_at is not null and read_at < now() - interval '14 days') or created_at < now() - interval '60 days'
$$);

-- Storage objects can only be removed through the Storage API: call the `cleanup` edge function daily.
select cron.schedule('teamhub_cleanup_files', '27 3 * * *', $$
  select net.http_post(
    url := (select value from teamhub_private.config where key = 'functions_url') || '/cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-teamhub-secret', (select value from teamhub_private.config where key = 'cleanup_secret')),
    body := '{}'::jsonb)
  where exists (select 1 from teamhub_private.config where key = 'functions_url')
$$);

-- Monthly storage snapshot for the Admin trend sparkline (max 12 entries, one row overwritten).
select cron.schedule('teamhub_storage_snapshot', '7 4 1 * *', $$
  update public.teamhub_settings set storage_history = (
    select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select x from jsonb_array_elements(storage_history) x
      union all
      select jsonb_build_object('month', to_char(now(), 'YYYY-MM'),
        'db', pg_database_size(current_database()),
        'files', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects))
      offset greatest(jsonb_array_length(storage_history) + 1 - 12, 0)
    ) s
  ) where id = 1
$$);
