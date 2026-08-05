create table public.social_studio_vocabulary_usage (
  id uuid primary key default gen_random_uuid(),
  language text not null,
  term text not null,
  normalized_term text not null,
  generator text not null,
  used_at timestamptz not null default now(),
  constraint social_studio_vocabulary_usage_term_check check (length(btrim(term)) > 0),
  constraint social_studio_vocabulary_usage_normalized_term_check check (length(btrim(normalized_term)) > 0)
);

create index social_studio_vocabulary_usage_language_term_used_at_idx
  on public.social_studio_vocabulary_usage (language, normalized_term, used_at desc);

alter table public.social_studio_vocabulary_usage enable row level security;

revoke all on table public.social_studio_vocabulary_usage from anon, authenticated;
grant select, insert, update, delete on table public.social_studio_vocabulary_usage to service_role;
