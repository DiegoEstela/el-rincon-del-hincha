-- Daily purge of expired comparisons with pg_cron (ADR 0006, section 4).
-- Reads already hide expired rows (get_comparison filters expires_at > now()); this job makes the
-- 90-day promise a real deletion. Kept in its own migration so it can be dropped if pg_cron is not
-- wanted. Re-applying is safe: the job is unscheduled before it is scheduled.

create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule('purge-expired-comparisons') where exists (select 1 from cron.job where jobname = 'purge-expired-comparisons');

-- 06:17 UTC, which is 03:17 in Buenos Aires.
select cron.schedule('purge-expired-comparisons', '17 6 * * *', $$delete from public.comparisons where expires_at <= now()$$);
