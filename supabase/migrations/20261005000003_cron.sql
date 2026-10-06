-- Reminders & escalations: run the SiteFlow tick every 10 minutes from
-- Supabase itself (pg_cron + pg_net). The tick logic lives in the app
-- (src/lib/services/reminders.ts, endpoint /api/cron/tick) so it shares the
-- dependency engine with everything else.
--
-- After deploying the app, schedule it once (SQL editor):
--   select public.siteflow_schedule_tick('https://your-app.example.com', '<CRON_SECRET>');
-- and to stop:
--   select cron.unschedule('siteflow-tick');

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.siteflow_schedule_tick(app_url text, cron_secret text, every text default '*/10 * * * *')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job bigint;
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'siteflow-tick';
  select cron.schedule(
    'siteflow-tick',
    every,
    format(
      $job$select net.http_post(url := %L, headers := jsonb_build_object('Authorization', %L, 'Content-Type', 'application/json'), body := '{}'::jsonb)$job$,
      rtrim(app_url, '/') || '/api/cron/tick',
      'Bearer ' || cron_secret
    )
  ) into v_job;
  return v_job;
end;
$$;

revoke all on function public.siteflow_schedule_tick(text, text, text) from public, anon, authenticated;
