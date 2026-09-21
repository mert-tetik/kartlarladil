create table if not exists public.user_translations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_language text not null,
  native_locale text not null,
  sentences jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_translations_sentences_array check (jsonb_typeof(sentences) = 'array')
);

create index if not exists user_translations_user_created_idx
  on public.user_translations (user_id, created_at desc);

alter table public.user_translations enable row level security;

grant select, insert, delete on table public.user_translations to authenticated;

create policy "Users can read their own translations"
  on public.user_translations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own translations"
  on public.user_translations
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own translations"
  on public.user_translations
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
