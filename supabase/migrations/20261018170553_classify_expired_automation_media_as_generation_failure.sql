-- The schedule-state backfill may have classified an expired generated asset
-- as a provider scheduling failure simply because its quality check had once
-- passed. Such outputs have no usable media and must remain generation
-- failures so the review UI offers regeneration, not a futile schedule retry.
with expired_generation_failures as (
  select output.id
  from public.social_content_automation_outputs as output
  where output.status in ('ready_to_schedule', 'failed')
    and output.quality_status = 'passed'
    and output.schedule_status = 'failed'
    and output.schedule_error_code = 'automation_media_retention_expired'
    and not exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(output.upload_post_jobs) = 'array' then output.upload_post_jobs
          else '[]'::jsonb
        end
      ) as job(value)
    )
)
update public.social_content_automation_outputs as output
set
  status = 'failed',
  error_code = 'automation_media_retention_expired',
  schedule_status = 'pending',
  schedule_error_code = null,
  schedule_error_detail = null,
  schedule_attempt_count = 0,
  schedule_attempted_at = null,
  schedule_completed_at = null
from expired_generation_failures
where output.id = expired_generation_failures.id;

with affected_runs as (
  select distinct run_id
  from public.social_content_automation_outputs
  where status = 'failed'
    and error_code = 'automation_media_retention_expired'
    and schedule_status = 'pending'
), run_states as (
  select
    output.run_id,
    bool_or(output.status in ('queued', 'processing', 'generating_video', 'awaiting_browser_image', 'awaiting_browser_video')) as has_active_output,
    bool_or(output.status = 'ready_to_schedule') as has_ready_output,
    bool_or(output.status = 'failed') as has_failed_output
  from public.social_content_automation_outputs as output
  join affected_runs on affected_runs.run_id = output.run_id
  group by output.run_id
)
update public.social_content_automation_runs as run
set
  status = case
    when run_states.has_active_output then 'processing'
    when run_states.has_ready_output then 'ready_to_schedule'
    when run_states.has_failed_output then 'completed_with_errors'
    else 'completed'
  end,
  completed_at = case
    when run_states.has_active_output or run_states.has_ready_output then null
    else coalesce(run.completed_at, now())
  end
from run_states
where run.id = run_states.run_id;
