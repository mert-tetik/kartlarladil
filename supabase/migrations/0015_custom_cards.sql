create table if not exists public.custom_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null unique,
  language text not null,
  tier text not null,
  term text not null,
  term_kind text not null default 'word',
  translations jsonb not null default '{}'::jsonb,
  translation_meanings jsonb not null default '{}'::jsonb,
  part_of_speech text not null default '',
  pronunciation text not null default '',
  examples jsonb not null default '[]'::jsonb,
  grammar jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.custom_cards is 'User-generated vocabulary cards created via the Create Card feature.';

create index if not exists idx_custom_cards_user_id on public.custom_cards(user_id);

alter table public.custom_cards enable row level security;

create policy "Users can read their own custom cards"
  on public.custom_cards
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own custom cards"
  on public.custom_cards
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own custom cards"
  on public.custom_cards
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own custom cards"
  on public.custom_cards
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.custom_cards to authenticated;
