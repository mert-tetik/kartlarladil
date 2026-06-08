create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table public.languages (
  code text primary key check (code in ('en', 'de', 'ru')),
  name text not null,
  native_name text not null,
  accent text not null,
  created_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  language_code text not null references public.languages(code) on update cascade on delete restrict,
  tier text not null check (tier in ('A1', 'A2', 'B1', 'B2', 'C1')),
  term text not null,
  translation_tr text not null,
  pronunciation text not null,
  part_of_speech text not null,
  example text not null,
  example_translation_tr text not null,
  examples jsonb not null default '[]'::jsonb check (jsonb_typeof(examples) = 'array'),
  grammar jsonb not null default '{}'::jsonb check (jsonb_typeof(grammar) = 'object'),
  created_at timestamptz not null default now(),
  unique (language_code, term)
);

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 2 and 80),
  preferred_language_code text default 'en' references public.languages(code) on update cascade on delete set null,
  preferred_tier text not null default 'A1' check (preferred_tier in ('A1', 'A2', 'B1', 'B2', 'C1')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_cards (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'learned')),
  correct_count integer not null default 0 check (correct_count >= 0),
  added_at timestamptz not null default now(),
  learned_at timestamptz,
  primary key (user_id, card_id)
);

create table public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  mode text not null check (mode in ('active', 'learned')),
  selected_answer text not null,
  correct_answer text not null,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

create index cards_language_tier_idx on public.cards(language_code, tier);
create index cards_term_trgm_idx on public.cards using gin (term gin_trgm_ops);
create index user_profiles_language_idx on public.user_profiles(preferred_language_code);
create index user_profiles_tier_idx on public.user_profiles(preferred_tier);
create index user_cards_user_status_idx on public.user_cards(user_id, status);
create index practice_attempts_user_created_idx on public.practice_attempts(user_id, created_at desc);

grant select on public.languages, public.cards to anon, authenticated;
grant select, insert, update on public.user_profiles to authenticated;
grant select, insert, update, delete on public.user_cards to authenticated;
grant select, insert on public.practice_attempts to authenticated;

alter table public.languages enable row level security;
alter table public.cards enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_cards enable row level security;
alter table public.practice_attempts enable row level security;

create policy "Languages are public"
  on public.languages for select
  to anon, authenticated
  using (true);

create policy "Cards are public"
  on public.cards for select
  to anon, authenticated
  using (true);

create policy "Users read own profile"
  on public.user_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own profile"
  on public.user_profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update own profile"
  on public.user_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users read own cards"
  on public.user_cards for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own cards"
  on public.user_cards for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update own cards"
  on public.user_cards for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete own cards"
  on public.user_cards for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users read own attempts"
  on public.practice_attempts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own attempts"
  on public.practice_attempts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
