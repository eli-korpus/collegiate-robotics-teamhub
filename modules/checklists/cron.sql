-- Prune runs older than 30 days, always keeping the latest 20 per list.
select cron.schedule('chk_prune_runs', '51 3 * * *', $$
  delete from public.chk_runs r using (
    select id, row_number() over (partition by list_id order by started_at desc) rn from public.chk_runs
  ) x where x.id = r.id and x.rn > 20 and r.started_at < now() - interval '30 days'
$$);
