alter table public.user_profiles
  add column if not exists profile_picture_index smallint;

update public.user_profiles
set profile_picture_index = floor(random() * 19)::smallint
where profile_picture_index is null;

alter table public.user_profiles
  alter column profile_picture_index set default floor(random() * 19)::smallint,
  alter column profile_picture_index set not null;

alter table public.user_profiles
  drop constraint if exists user_profiles_profile_picture_index_check;

alter table public.user_profiles
  add constraint user_profiles_profile_picture_index_check
    check (profile_picture_index between 0 and 18);

