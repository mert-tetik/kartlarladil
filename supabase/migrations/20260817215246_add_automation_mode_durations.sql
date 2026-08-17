create table public.social_content_automation_mode_durations (
  generator text primary key,
  average_duration_ms integer not null check (average_duration_ms > 0),
  successful_generation_count integer not null default 1 check (successful_generation_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_content_automation_mode_durations enable row level security;

revoke all on table public.social_content_automation_mode_durations from public, anon, authenticated;
grant select, insert, update, delete on table public.social_content_automation_mode_durations to service_role;

alter table public.social_content_automation_outputs
  add column if not exists generation_attempt_started_at timestamptz,
  add column if not exists duration_recorded_at timestamptz;

create or replace function public.record_social_content_automation_mode_duration(
  p_output_id uuid,
  p_duration_ms integer
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_duration_ms <= 0 then
    raise exception 'Invalid automation mode duration input';
  end if;

  with completed_output as (
    update public.social_content_automation_outputs
    set duration_recorded_at = now(), updated_at = now()
    where id = p_output_id
      and status in ('ready_to_schedule', 'scheduled')
      and duration_recorded_at is null
    returning generator
  )
  insert into public.social_content_automation_mode_durations (
    generator,
    average_duration_ms,
    successful_generation_count,
    updated_at
  )
  select generator, p_duration_ms, 1, now()
  from completed_output
  on conflict (generator) do update
  set
    average_duration_ms = round((public.social_content_automation_mode_durations.average_duration_ms + excluded.average_duration_ms) / 2.0)::integer,
    successful_generation_count = public.social_content_automation_mode_durations.successful_generation_count + 1,
    updated_at = now();

  return found;
end;
$$;

revoke all on function public.record_social_content_automation_mode_duration(uuid, integer) from public, anon, authenticated;
grant execute on function public.record_social_content_automation_mode_duration(uuid, integer) to service_role;
