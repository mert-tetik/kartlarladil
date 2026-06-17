alter table public.user_profiles
  add column if not exists theme text;

grant select, update on public.user_profiles to authenticated;
