create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  webhook_id text not null unique,
  event_name text not null,
  payload jsonb not null,
  user_id uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists webhook_events_user_created_idx
  on public.webhook_events(user_id, created_at desc);

create index if not exists webhook_events_webhook_id_idx
  on public.webhook_events(webhook_id);

grant all on public.webhook_events to service_role;
grant select on public.webhook_events to authenticated;

alter table public.webhook_events enable row level security;

create policy "Users read own webhook events"
  on public.webhook_events for select
  to authenticated
  using ((select auth.uid()) = user_id);
