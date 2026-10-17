-- Keep a small, server-only event stream for developer analytics.
-- The service-role client is the only application path that writes or reads it.

create table if not exists public.app_login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_login_events_created_at_idx
  on public.app_login_events (created_at desc);

create index if not exists app_login_events_user_id_created_at_idx
  on public.app_login_events (user_id, created_at desc);

alter table public.app_login_events enable row level security;
revoke all on table public.app_login_events from public, anon, authenticated;
grant all on table public.app_login_events to service_role;
