-- Shared circuit-breaker state for Social Content Studio's text provider.
create table if not exists public.social_content_automation_provider_health (
  provider_name text primary key check (provider_name in ('poyo_responses', 'openai_responses')),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  last_failure_at timestamptz,
  last_success_at timestamptz,
  open_until timestamptz,
  updated_at timestamptz not null default now()
);

-- The original version of this migration may already have created a PoYo-only
-- health table. Upgrade that existing check before OpenAI health records are
-- written, while remaining a no-op on a fresh database.
alter table public.social_content_automation_provider_health
  drop constraint if exists social_content_automation_provider_health_provider_name_check;

alter table public.social_content_automation_provider_health
  add constraint social_content_automation_provider_health_provider_name_check
  check (provider_name in ('poyo_responses', 'openai_responses'));

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
  if p_provider_name not in ('poyo_responses', 'openai_responses') then
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

-- Persist only redacted provider diagnostics. This lets the result screen
-- distinguish a rate limit, timeout, circuit-open state, or malformed request
-- without ever storing prompts or credentials.
alter table public.social_content_automation_outputs
  add column if not exists last_error_detail text,
  add column if not exists last_provider text
    check (last_provider is null or last_provider in ('poyo', 'openai')),
  add column if not exists last_provider_status smallint
    check (last_provider_status is null or last_provider_status between 100 and 599),
  add column if not exists last_provider_attempt_count smallint
    check (last_provider_attempt_count is null or last_provider_attempt_count between 1 and 3),
  add column if not exists last_provider_request_id text;

-- A database-backed capacity lease prevents independent route invocations from
-- stampeding direct OpenAI fallback together. Expired leases are removed by the
-- acquisition RPC, so a terminated request cannot hold capacity indefinitely.
create table if not exists public.social_content_automation_provider_leases (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null check (provider_name in ('openai_responses')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.social_content_automation_provider_leases enable row level security;
revoke all on table public.social_content_automation_provider_leases from public, anon, authenticated;
grant select, insert, update, delete on table public.social_content_automation_provider_leases to service_role;

create index if not exists social_content_automation_provider_leases_expiry_idx
  on public.social_content_automation_provider_leases (provider_name, expires_at);

-- security invoker keeps this function inside the service-role boundary. The
-- advisory lock makes the count and insert atomic across concurrent workers.
create or replace function public.acquire_social_content_automation_provider_lease(
  p_provider_name text,
  p_max_concurrency integer default 2,
  p_lease_seconds integer default 90
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_lease_id uuid;
  active_lease_count integer;
begin
  if p_provider_name <> 'openai_responses' then
    raise exception 'unsupported_social_content_automation_provider';
  end if;
  if p_max_concurrency not between 1 and 8 then
    raise exception 'invalid_social_content_automation_provider_concurrency';
  end if;
  if p_lease_seconds not between 30 and 180 then
    raise exception 'invalid_social_content_automation_provider_lease_seconds';
  end if;

  perform pg_advisory_xact_lock(hashtext('social-content-automation-provider:' || p_provider_name));
  delete from public.social_content_automation_provider_leases
  where provider_name = p_provider_name
    and expires_at <= now();

  select count(*)
  into active_lease_count
  from public.social_content_automation_provider_leases
  where provider_name = p_provider_name
    and expires_at > now();

  if active_lease_count >= p_max_concurrency then
    return null;
  end if;

  insert into public.social_content_automation_provider_leases (provider_name, expires_at)
  values (p_provider_name, now() + make_interval(secs => p_lease_seconds))
  returning id into next_lease_id;

  return next_lease_id;
end;
$$;

revoke all on function public.acquire_social_content_automation_provider_lease(text, integer, integer) from public, anon, authenticated;
grant execute on function public.acquire_social_content_automation_provider_lease(text, integer, integer) to service_role;
