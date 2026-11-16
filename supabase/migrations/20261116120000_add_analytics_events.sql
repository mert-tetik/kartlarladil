-- Keep product analytics separate from user-facing domain data.
-- The service-role client is the only application path that writes or reads it.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null check (length(trim(event_name)) between 1 and 100),
  properties jsonb not null default '{}'::jsonb
    check (jsonb_typeof(properties) = 'object'),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists analytics_events_name_created_at_idx
  on public.analytics_events (event_name, created_at desc);

create index if not exists analytics_events_user_id_created_at_idx
  on public.analytics_events (user_id, created_at desc);

-- Tutorial completion is a milestone, not a repeatable event. This keeps
-- retries, refreshes, and duplicate beacon delivery from inflating the count.
create unique index if not exists analytics_events_one_tutorial_completion_per_user_idx
  on public.analytics_events (user_id)
  where event_name = 'tutorial_completed';

alter table public.analytics_events enable row level security;
revoke all on table public.analytics_events from public, anon, authenticated;
grant all on table public.analytics_events to service_role;
