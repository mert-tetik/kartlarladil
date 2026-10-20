-- Finishing a batch closes content generation, not delivery reconciliation.
-- Provider-confirmation waits must not hold the run open indefinitely.
create or replace function public.finish_social_content_automation_run(
  p_owner_key text,
  p_run_id uuid
)
returns table (finished boolean, status text)
language plpgsql
set search_path = ''
as $$
declare
  v_run public.social_content_automation_runs%rowtype;
  v_active_count integer;
  v_error_count integer;
  v_status text;
begin
  select * into v_run
  from public.social_content_automation_runs as run
  where run.id = p_run_id
    and run.owner_key = p_owner_key
  for update;

  if not found then
    return query select false, null::text;
    return;
  end if;
  if v_run.finished_by_user_at is not null then
    return query select true, v_run.status;
    return;
  end if;

  -- Only active generation blocks finishing. A ready output may still be
  -- waiting for Upload-Post, and that independent lifecycle remains recoverable
  -- from the generated-post list after the run is closed.
  select count(*) into v_active_count
  from public.social_content_automation_outputs as output
  where output.run_id = p_run_id
    and output.status in ('queued', 'processing', 'generating_video', 'awaiting_browser_image', 'awaiting_browser_video');

  if v_active_count > 0 then
    return query select false, null::text;
    return;
  end if;

  select count(*) into v_error_count
  from public.social_content_automation_outputs as output
  where output.run_id = p_run_id
    and (output.status = 'failed'
      or (output.status = 'skipped' and output.error_code is not null)
      or output.schedule_status in ('failed', 'partially_scheduled', 'processing'));

  v_status := case when v_error_count > 0 then 'completed_with_errors' else 'completed' end;
  update public.social_content_automation_runs as run
  set finished_by_user_at = now(),
      status = v_status,
      completed_at = now()
  where run.id = p_run_id and run.owner_key = p_owner_key;

  return query select true, v_status;
end;
$$;

revoke all on function public.finish_social_content_automation_run(text, uuid) from public, anon, authenticated;
grant execute on function public.finish_social_content_automation_run(text, uuid) to service_role;
