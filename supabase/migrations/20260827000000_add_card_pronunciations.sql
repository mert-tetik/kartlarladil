create table if not exists public.card_pronunciations (
  card_source_key text primary key,
  pronunciation text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  requested_by uuid references auth.users(id) on delete set null,
  processing_started_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists card_pronunciations_pending_idx
  on public.card_pronunciations(status, processing_started_at);

alter table public.card_pronunciations enable row level security;

-- All reads and writes go through the authenticated server route. This cache must
-- not be directly queryable from browsers or writable by clients.
revoke all on table public.card_pronunciations from anon, authenticated;
