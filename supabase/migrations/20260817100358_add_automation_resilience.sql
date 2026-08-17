-- Durable automation recovery, preflight state and the renderer-agent identity.
alter table public.social_content_automation_runs
  add column if not exists auto_schedule_on_success boolean not null default true,
  add column if not exists preflight_status text not null default 'pending'
    check (preflight_status in ('pending', 'passed', 'failed')),
  add column if not exists preflight_details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preflight_details) = 'object'),
  add column if not exists preflight_checked_at timestamptz,
  add column if not exists auto_schedule_started_at timestamptz,
  add column if not exists auto_schedule_completed_at timestamptz,
  add column if not exists auto_schedule_error text;

create table if not exists public.social_content_automation_renderers (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  label text not null check (char_length(label) between 1 and 120),
  token_hash text not null unique,
  capabilities jsonb not null default '["browser_render"]'::jsonb
    check (jsonb_typeof(capabilities) = 'array'),
  active boolean not null default true,
  last_heartbeat_at timestamptz,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_content_automation_renderers enable row level security;
revoke all on table public.social_content_automation_renderers from anon, authenticated;
grant select, insert, update, delete on table public.social_content_automation_renderers to service_role;

alter table public.social_content_automation_outputs
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists last_error_class text,
  add column if not exists lease_renderer_id uuid references public.social_content_automation_renderers(id) on delete set null,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists renderer_heartbeat_at timestamptz,
  add column if not exists quality_status text not null default 'pending'
    check (quality_status in ('pending', 'passed', 'failed')),
  add column if not exists quality_error text,
  add column if not exists quality_checked_at timestamptz,
  add column if not exists retry_exhausted_at timestamptz,
  add column if not exists render_plan jsonb;

create index if not exists social_content_automation_outputs_retry_idx
  on public.social_content_automation_outputs (status, next_attempt_at, scheduled_at);

create index if not exists social_content_automation_outputs_lease_idx
  on public.social_content_automation_outputs (lease_renderer_id, lease_expires_at)
  where lease_renderer_id is not null;

create index if not exists social_content_automation_renderers_owner_idx
  on public.social_content_automation_renderers (owner_key, active, last_heartbeat_at desc);

create table if not exists public.social_content_automation_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  endpoint text not null unique,
  subscription jsonb not null check (jsonb_typeof(subscription) = 'object'),
  active boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_content_automation_push_subscriptions enable row level security;
revoke all on table public.social_content_automation_push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.social_content_automation_push_subscriptions to service_role;

create index if not exists social_content_automation_push_subscriptions_owner_idx
  on public.social_content_automation_push_subscriptions (owner_key, active);
