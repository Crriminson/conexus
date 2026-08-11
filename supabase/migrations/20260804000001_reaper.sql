-- Layer 3 (the only real guarantee): a hard-killed worker can't be trusted
-- to mark itself failed, so the backstop lives outside it entirely. Runs
-- every minute; anything stuck in `processing` past 5 minutes is reaped.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'reap-stuck-extractions',
  '* * * * *',
  $$
  update documents
     set extraction_status = 'failed',
         extraction_error = 'Extraction timed out (reaped)'
   where extraction_status = 'processing'
     and extraction_started_at < now() - interval '5 minutes'
  $$
);
