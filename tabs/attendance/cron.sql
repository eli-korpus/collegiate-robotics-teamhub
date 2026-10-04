select cron.schedule('att_prune_codes', '15 * * * *', $$ delete from public.att_codes where expires_at < now() - interval '1 hour' $$);
