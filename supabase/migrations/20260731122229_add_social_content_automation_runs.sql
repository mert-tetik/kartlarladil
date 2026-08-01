create table public.social_content_automation_runs (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  horizon_days smallint not null check (horizon_days in (1, 3, 7)),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'completed_with_errors')),
  total_outputs integer not null default 0 check (total_outputs >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.social_content_automation_outputs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.social_content_automation_runs(id) on delete cascade,
  day_offset smallint not null check (day_offset between 1 and 7),
  group_name text not null,
  content_type text not null check (content_type in ('random', 'text', 'image', 'video')),
  generator text not null,
  language text not null,
  native_language text not null,
  tier text not null,
  scheduled_at timestamptz not null,
  target_account_ids jsonb not null check (jsonb_typeof(target_account_ids) = 'array'),
  status text not null default 'queued' check (status in ('queued', 'processing', 'generating_video', 'scheduled', 'failed')),
  caption text,
  media_path text,
  media_type text check (media_type in ('image', 'video')),
  provider_task_id text,
  upload_post_jobs jsonb not null default '[]'::jsonb check (jsonb_typeof(upload_post_jobs) = 'array'),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  generated_at timestamptz,
  scheduled_at_upload_post timestamptz
);

create index social_content_automation_outputs_run_id_idx
  on public.social_content_automation_outputs (run_id, created_at desc);

create index social_content_automation_outputs_status_idx
  on public.social_content_automation_outputs (status, scheduled_at);

alter table public.social_content_automation_runs enable row level security;
alter table public.social_content_automation_outputs enable row level security;

revoke all on table public.social_content_automation_runs from anon, authenticated;
revoke all on table public.social_content_automation_outputs from anon, authenticated;
grant select, insert, update, delete on table public.social_content_automation_runs to service_role;
grant select, insert, update, delete on table public.social_content_automation_outputs to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-studio-automation',
  'social-studio-automation',
  false,
  6291456,
  array['image/webp', 'image/png', 'image/jpeg']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
