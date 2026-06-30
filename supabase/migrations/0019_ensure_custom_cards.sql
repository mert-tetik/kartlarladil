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

alter table public.custom_cards
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists source_key text,
  add column if not exists language text,
  add column if not exists tier text,
  add column if not exists term text,
  add column if not exists term_kind text default 'word',
  add column if not exists translations jsonb default '{}'::jsonb,
  add column if not exists translation_meanings jsonb default '{}'::jsonb,
  add column if not exists part_of_speech text default '',
  add column if not exists pronunciation text default '',
  add column if not exists examples jsonb default '[]'::jsonb,
  add column if not exists grammar jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

alter table public.custom_cards
  alter column id set default gen_random_uuid(),
  alter column user_id set not null,
  alter column source_key set not null,
  alter column language set not null,
  alter column tier set not null,
  alter column term set not null,
  alter column term_kind set not null,
  alter column term_kind set default 'word',
  alter column translations set not null,
  alter column translations set default '{}'::jsonb,
  alter column translation_meanings set not null,
  alter column translation_meanings set default '{}'::jsonb,
  alter column part_of_speech set not null,
  alter column part_of_speech set default '',
  alter column pronunciation set not null,
  alter column pronunciation set default '',
  alter column examples set not null,
  alter column examples set default '[]'::jsonb,
  alter column grammar set not null,
  alter column grammar set default '{}'::jsonb,
  alter column created_at set not null,
  alter column created_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'custom_cards_pkey'
      and conrelid = 'public.custom_cards'::regclass
  ) then
    alter table public.custom_cards add constraint custom_cards_pkey primary key (id);
  end if;
end $$;

create unique index if not exists custom_cards_source_key_idx
  on public.custom_cards(source_key);

create index if not exists idx_custom_cards_user_id
  on public.custom_cards(user_id);

comment on table public.custom_cards is 'User-generated vocabulary cards created via the Create Card feature.';

alter table public.custom_cards enable row level security;

drop policy if exists "Users can read their own custom cards" on public.custom_cards;
create policy "Users can read their own custom cards"
  on public.custom_cards
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own custom cards" on public.custom_cards;
create policy "Users can insert their own custom cards"
  on public.custom_cards
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own custom cards" on public.custom_cards;
create policy "Users can update their own custom cards"
  on public.custom_cards
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own custom cards" on public.custom_cards;
create policy "Users can delete their own custom cards"
  on public.custom_cards
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.custom_cards to authenticated;
