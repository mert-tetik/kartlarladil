-- Run this in Supabase SQL Editor after deployment.
-- Replace the URL and secret with your production values.

select cron.schedule(
  'foxiesdeck-push-inactivity-daily',
  '0 12 * * *',
  $$
  select
    net.http_post(
      url := 'https://www.foxiesdeck.com/api/internal/push/send-inactivity',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-cron-secret', 'REPLACE_WITH_PUSH_CRON_SECRET'
      ),
      body := '{}'::jsonb
    );
  $$
);
