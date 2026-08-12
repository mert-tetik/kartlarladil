alter table public.social_content_automation_outputs
  drop constraint if exists social_content_automation_outputs_status_check;

alter table public.social_content_automation_outputs
  add constraint social_content_automation_outputs_status_check
  check (status in ('queued', 'processing', 'generating_video', 'awaiting_browser_video', 'ready_to_schedule', 'scheduled', 'failed'));

alter table public.social_content_automation_runs
  drop constraint if exists social_content_automation_runs_status_check;

alter table public.social_content_automation_runs
  add constraint social_content_automation_runs_status_check
  check (status in ('queued', 'processing', 'ready_to_schedule', 'completed', 'completed_with_errors'));
