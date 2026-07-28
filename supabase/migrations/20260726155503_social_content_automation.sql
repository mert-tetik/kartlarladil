create table public.social_content_automation_state (
  owner_key text primary key,
  groups jsonb not null default '[]'::jsonb
    check (jsonb_typeof(groups) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.social_content_automation_state enable row level security;

revoke all on table public.social_content_automation_state from anon, authenticated;
grant select, insert, update, delete on table public.social_content_automation_state to service_role;
