-- Earlier automation runs could finish with a run-level schedule error while
-- leaving each unposted, quality-passed output in ready_to_schedule. The first
-- schedule lifecycle migration gives those rows the default "pending" state;
-- this backfill restores their actual per-output failure state without
-- conflating it with generation failure.
with legacy_schedule_failures as (
  select
    output.id,
    run.auto_schedule_started_at as attempted_at,
    exists (
      select 1
      from jsonb_array_elements(coalesce(output.upload_post_jobs, '[]'::jsonb)) as job(value)
      where nullif(job.value ->> 'jobId', '') is not null
    ) as has_confirmed_job
  from public.social_content_automation_outputs as output
  join public.social_content_automation_runs as run
    on run.id = output.run_id
  where run.auto_schedule_error = 'automation_schedule_partial_failure'
    and run.auto_schedule_started_at is not null
    and output.status = 'ready_to_schedule'
    and output.quality_status = 'passed'
    and output.schedule_status = 'pending'
    and output.error_code is distinct from 'automation_media_retention_expired'
    and output.schedule_error_code is distinct from 'automation_media_retention_expired'
    and output.updated_at >= run.auto_schedule_started_at
)
update public.social_content_automation_outputs as output
set
  schedule_status = case
    when legacy_schedule_failures.has_confirmed_job then 'partially_scheduled'
    else 'failed'
  end,
  schedule_error_code = 'automation_schedule_partial_failure',
  schedule_error_detail = 'A previous automatic schedule attempt failed before per-output error details were stored.',
  schedule_attempt_count = greatest(coalesce(output.schedule_attempt_count, 0), 1),
  schedule_attempted_at = coalesce(output.schedule_attempted_at, legacy_schedule_failures.attempted_at, output.updated_at),
  schedule_completed_at = null,
  error_code = null,
  updated_at = now()
from legacy_schedule_failures
where output.id = legacy_schedule_failures.id;
