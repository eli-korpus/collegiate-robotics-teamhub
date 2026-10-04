-- 30 days after a poll closes: keep the totals, delete individual answers (spec §13.7).
select cron.schedule('poll_finalize', '13 4 * * *', $$ select public.poll_finalize() $$);
