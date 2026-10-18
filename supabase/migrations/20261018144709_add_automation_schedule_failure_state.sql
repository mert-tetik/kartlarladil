alter table public.social_content_automation_outputs
  add column schedule_status text not null default 'pending',
  add column schedule_error_code text,
  add column schedule_error_detail text,
  add column schedule_attempt_count integer not null default 0,
  add column schedule_attempted_at timestamptz,
  add column schedule_completed_at timestamptz;

alter table public.social_content_automation_outputs
  add constraint social_content_automation_outputs_schedule_status_check
  check (schedule_status in ('pending', 'processing', 'partially_scheduled', 'failed', 'scheduled')),
  add constraint social_content_automation_outputs_schedule_attempt_count_check
  check (schedule_attempt_count >= 0);

-- Earlier builds stored scheduling failures in the generation status. A passed
-- quality check proves the generated content itself was complete, so move those
-- records back to the review queue and retain the error in the new schedule state.
update public.social_content_automation_outputs
set
  schedule_status = case
    when status = 'scheduled' then 'scheduled'
    when status = 'failed' and jsonb_array_length(upload_post_jobs) > 0 then 'partially_scheduled'
    when status = 'failed' and quality_status = 'passed' and error_code is distinct from 'automation_media_retention_expired' then 'failed'
    else 'pending'
  end,
  schedule_error_code = case
    when status = 'failed' and (jsonb_array_length(upload_post_jobs) > 0 or (quality_status = 'passed' and error_code is distinct from 'automation_media_retention_expired')) then error_code
    else null
  end,
  schedule_error_detail = case
    when status = 'failed' and (jsonb_array_length(upload_post_jobs) > 0 or (quality_status = 'passed' and error_code is distinct from 'automation_media_retention_expired')) then error_code
    else null
  end,
  schedule_attempt_count = case
    when status = 'scheduled' or (status = 'failed' and (jsonb_array_length(upload_post_jobs) > 0 or (quality_status = 'passed' and error_code is distinct from 'automation_media_retention_expired'))) then 1
    else 0
  end,
  schedule_attempted_at = case
    when status = 'scheduled' then scheduled_at_upload_post
    when status = 'failed' and (jsonb_array_length(upload_post_jobs) > 0 or (quality_status = 'passed' and error_code is distinct from 'automation_media_retention_expired')) then updated_at
    else null
  end,
  schedule_completed_at = case when status = 'scheduled' then scheduled_at_upload_post else null end,
  status = case
    when status = 'failed' and (jsonb_array_length(upload_post_jobs) > 0 or (quality_status = 'passed' and error_code is distinct from 'automation_media_retention_expired')) then 'ready_to_schedule'
    else status
  end,
  error_code = case
    when status = 'failed' and (jsonb_array_length(upload_post_jobs) > 0 or (quality_status = 'passed' and error_code is distinct from 'automation_media_retention_expired')) then null
    else error_code
  end
where status = 'scheduled'
  or (status = 'failed' and (jsonb_array_length(upload_post_jobs) > 0 or (quality_status = 'passed' and error_code is distinct from 'automation_media_retention_expired')));

create index social_content_automation_outputs_schedule_retry_idx
  on public.social_content_automation_outputs (run_id, schedule_status, scheduled_at)
  where status = 'ready_to_schedule';

comment on column public.social_content_automation_outputs.schedule_status is
  'Independent scheduling lifecycle; generation status remains ready_to_schedule when publishing fails.';
comment on column public.social_content_automation_outputs.upload_post_jobs is
  'Durable per-account Upload-Post job records; populated after each accepted schedule request.';
