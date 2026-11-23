-- Keep one durable, account-linked row for every application session.
-- Writes happen only through the authenticated server-side analytics route.

create table if not exists public.analytics_sessions (
  session_id uuid primary key,
  user_id uuid references auth.users(id) on delete set null,
  platform text not null default 'web'
    check (platform in ('web', 'twa')),
  started_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  end_reason text
    check (end_reason is null or end_reason in ('pagehide', 'logout', 'native_pause', 'timeout', 'unknown')),
  duration_seconds integer generated always as (
    greatest(
      0::numeric,
      floor(extract(epoch from (coalesce(ended_at, last_seen_at) - started_at)))
    )::integer
  ) stored,
  created_at timestamptz not null default timezone('utc', now()),
  constraint analytics_sessions_last_seen_after_start_check
    check (last_seen_at >= started_at),
  constraint analytics_sessions_end_after_start_check
    check (ended_at is null or ended_at >= started_at),
  constraint analytics_sessions_last_seen_before_end_check
    check (ended_at is null or last_seen_at <= ended_at)
);

create index if not exists analytics_sessions_user_started_at_idx
  on public.analytics_sessions (user_id, started_at desc);

create index if not exists analytics_sessions_active_idx
  on public.analytics_sessions (last_seen_at desc)
  where ended_at is null;

alter table public.analytics_sessions enable row level security;
revoke all on table public.analytics_sessions from public, anon, authenticated;
grant all on table public.analytics_sessions to service_role;
