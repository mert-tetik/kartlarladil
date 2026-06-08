alter table public.user_profiles
  alter column preferred_language_code set default 'en',
  add column if not exists preferred_tier text not null default 'A1'
    check (preferred_tier in ('A1', 'A2', 'B1', 'B2', 'C1'));

create index if not exists user_profiles_tier_idx on public.user_profiles(preferred_tier);
