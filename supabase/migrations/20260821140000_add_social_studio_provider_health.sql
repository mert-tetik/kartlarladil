-- Shared circuit-breaker state for Social Content Studio's text provider.
create table if not exists public.social_content_automation_provider_health (
  provider_name text primary key check (provider_name in ('poyo_responses')),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  last_failure_at timestamptz,
  last_success_at timestamptz,
  open_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.social_content_automation_provider_health enable row level security;

revoke all on table public.social_content_automation_provider_health from public, anon, authenticated;
grant select, insert, update, delete on table public.social_content_automation_provider_health to service_role;

create or replace function public.record_social_content_automation_provider_failure(
  p_provider_name text,
  p_failure_window_seconds integer default 120,
  p_circuit_open_seconds integer default 300
)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_failure_count integer;
  next_open_until timestamptz;
begin
  if p_provider_name <> 'poyo_responses' then
    raise exception 'unsupported_social_content_automation_provider';
  end if;

  insert into public.social_content_automation_provider_health (
    provider_name,
    consecutive_failures,
    last_failure_at,
    updated_at
  )
  values (p_provider_name, 1, now(), now())
  on conflict (provider_name) do update
  set consecutive_failures = case
        when public.social_content_automation_provider_health.last_failure_at >= now() - make_interval(secs => p_failure_window_seconds)
          then public.social_content_automation_provider_health.consecutive_failures + 1
        else 1
      end,
      last_failure_at = now(),
      open_until = case
        when public.social_content_automation_provider_health.last_failure_at >= now() - make_interval(secs => p_failure_window_seconds)
          then public.social_content_automation_provider_health.open_until
        else null
      end,
      updated_at = now()
  returning consecutive_failures into next_failure_count;

  if next_failure_count >= 2 then
    next_open_until := now() + make_interval(secs => p_circuit_open_seconds);
    update public.social_content_automation_provider_health
    set open_until = next_open_until,
        updated_at = now()
    where provider_name = p_provider_name;
    return next_open_until;
  end if;

  return null;
end;
$$;

revoke all on function public.record_social_content_automation_provider_failure(text, integer, integer) from public, anon, authenticated;
grant execute on function public.record_social_content_automation_provider_failure(text, integer, integer) to service_role;
