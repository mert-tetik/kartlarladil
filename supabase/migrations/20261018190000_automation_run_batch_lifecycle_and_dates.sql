alter table public.social_content_automation_runs
  add column if not exists schedule_date date,
  add column if not exists request_key uuid,
  add column if not exists generation_stopped_at timestamptz,
  add column if not exists finished_by_user_at timestamptz;

-- Preserve the inferred anchor for existing runs. Legacy runs may share dates;
-- only newly created runs are date-unique.
with inferred_dates as (
  select
    run.id,
    coalesce(
      min((output.scheduled_at at time zone 'Europe/Istanbul')::date - (output.day_offset - 1)),
      (run.created_at at time zone 'Europe/Istanbul')::date + 1
    ) as schedule_date
  from public.social_content_automation_runs as run
  left join public.social_content_automation_outputs as output on output.run_id = run.id
  where run.schedule_date is null
  group by run.id, run.created_at
)
update public.social_content_automation_runs as run
set schedule_date = inferred_dates.schedule_date
from inferred_dates
where run.id = inferred_dates.id;

alter table public.social_content_automation_runs
  alter column schedule_date set not null;

create unique index if not exists social_content_automation_runs_owner_request_key_idx
  on public.social_content_automation_runs (owner_key, request_key)
  where request_key is not null;

create unique index if not exists social_content_automation_runs_owner_schedule_date_new_idx
  on public.social_content_automation_runs (owner_key, schedule_date)
  where request_key is not null;

create index if not exists social_content_automation_runs_owner_schedule_date_idx
  on public.social_content_automation_runs (owner_key, schedule_date);

alter table public.social_content_automation_outputs
  drop constraint if exists social_content_automation_outputs_status_check;

alter table public.social_content_automation_outputs
  add constraint social_content_automation_outputs_status_check
  check (status in ('queued', 'processing', 'generating_video', 'awaiting_browser_image', 'awaiting_browser_video', 'ready_to_schedule', 'scheduled', 'failed', 'skipped'));

create or replace function public.create_social_content_automation_run(
  p_owner_key text,
  p_request_key uuid,
  p_horizon_days smallint,
  p_total_outputs integer,
  p_preflight_details jsonb
)
returns table (
  id uuid,
  horizon_days smallint,
  created_at timestamptz,
  schedule_date date,
  was_created boolean
)
language plpgsql
set search_path = ''
as $$
declare
  v_run public.social_content_automation_runs%rowtype;
  v_schedule_date date;
begin
  if p_horizon_days not in (1, 3, 7) or p_total_outputs < 0 or p_owner_key is null or p_request_key is null then
    raise exception 'invalid_automation_run_request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner_key, 0));

  select * into v_run
  from public.social_content_automation_runs as run
  where run.owner_key = p_owner_key and run.request_key = p_request_key;

  if found then
    if v_run.horizon_days <> p_horizon_days then
      raise exception 'automation_run_idempotency_conflict';
    end if;
    return query select v_run.id, v_run.horizon_days, v_run.created_at, v_run.schedule_date, false;
    return;
  end if;

  v_schedule_date := (now() at time zone 'Europe/Istanbul')::date + 1;
  while exists (
    select 1
    from public.social_content_automation_runs as run
    where run.owner_key = p_owner_key and run.schedule_date = v_schedule_date
  ) loop
    v_schedule_date := v_schedule_date + 1;
  end loop;

  insert into public.social_content_automation_runs (
    owner_key,
    request_key,
    schedule_date,
    horizon_days,
    status,
    total_outputs,
    preflight_status,
    preflight_checked_at,
    preflight_details
  ) values (
    p_owner_key,
    p_request_key,
    v_schedule_date,
    p_horizon_days,
    'queued',
    p_total_outputs,
    'passed',
    now(),
    coalesce(p_preflight_details, '{}'::jsonb)
  ) returning * into v_run;

  return query select v_run.id, v_run.horizon_days, v_run.created_at, v_run.schedule_date, true;
end;
$$;

create or replace function public.stop_social_content_automation_generation(
  p_owner_key text,
  p_run_id uuid
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_run_id uuid;
begin
  update public.social_content_automation_runs as run
  set generation_stopped_at = coalesce(run.generation_stopped_at, now()),
      status = 'ready_to_schedule',
      completed_at = null
  where run.id = p_run_id
    and run.owner_key = p_owner_key
    and run.finished_by_user_at is null
  returning run.id into v_run_id;

  if v_run_id is null then
    return false;
  end if;

  update public.social_content_automation_outputs as output
  set status = 'skipped',
      lease_renderer_id = null,
      lease_expires_at = null,
      updated_at = now()
  where output.run_id = p_run_id
    and output.status in ('queued', 'processing', 'generating_video', 'awaiting_browser_image', 'awaiting_browser_video', 'failed');

  return true;
end;
$$;

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

  select count(*) into v_active_count
  from public.social_content_automation_outputs as output
  where output.run_id = p_run_id
    and (output.status in ('queued', 'processing', 'generating_video', 'awaiting_browser_image', 'awaiting_browser_video') or output.schedule_status = 'processing');

  if v_active_count > 0 then
    return query select false, null::text;
    return;
  end if;

  select count(*) into v_error_count
  from public.social_content_automation_outputs as output
  where output.run_id = p_run_id
    and (output.status = 'failed'
      or (output.status = 'skipped' and output.error_code is not null)
      or output.schedule_status in ('failed', 'partially_scheduled'));

  v_status := case when v_error_count > 0 then 'completed_with_errors' else 'completed' end;
  update public.social_content_automation_runs as run
  set finished_by_user_at = now(),
      status = v_status,
      completed_at = now()
  where run.id = p_run_id and run.owner_key = p_owner_key;

  return query select true, v_status;
end;
$$;

create or replace function public.guard_stopped_social_content_automation_output()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_generation_stopped_at timestamptz;
begin
  if new.status in ('queued', 'processing', 'generating_video', 'awaiting_browser_image', 'awaiting_browser_video', 'ready_to_schedule', 'failed') then
    select run.generation_stopped_at into v_generation_stopped_at
    from public.social_content_automation_runs as run
    where run.id = new.run_id;

    if v_generation_stopped_at is not null
      and old.status not in ('ready_to_schedule', 'scheduled', 'skipped') then
      new.status := 'skipped';
      new.lease_renderer_id := null;
      new.lease_expires_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists social_content_automation_stop_generation_guard on public.social_content_automation_outputs;
create trigger social_content_automation_stop_generation_guard
before update of status on public.social_content_automation_outputs
for each row execute function public.guard_stopped_social_content_automation_output();

revoke all on function public.create_social_content_automation_run(text, uuid, smallint, integer, jsonb) from public, anon, authenticated;
revoke all on function public.stop_social_content_automation_generation(text, uuid) from public, anon, authenticated;
revoke all on function public.finish_social_content_automation_run(text, uuid) from public, anon, authenticated;
revoke all on function public.guard_stopped_social_content_automation_output() from public, anon, authenticated;
grant execute on function public.create_social_content_automation_run(text, uuid, smallint, integer, jsonb) to service_role;
grant execute on function public.stop_social_content_automation_generation(text, uuid) to service_role;
grant execute on function public.finish_social_content_automation_run(text, uuid) to service_role;
grant execute on function public.guard_stopped_social_content_automation_output() to service_role;
