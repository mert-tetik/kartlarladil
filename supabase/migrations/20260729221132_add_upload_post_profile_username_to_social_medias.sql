alter table public.social_medias
  add column if not exists "upload-post profile username" text;
