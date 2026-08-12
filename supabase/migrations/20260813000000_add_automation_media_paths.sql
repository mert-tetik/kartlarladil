alter table public.social_content_automation_outputs
  add column if not exists media_paths jsonb not null default '[]'::jsonb
  check (jsonb_typeof(media_paths) = 'array');

comment on column public.social_content_automation_outputs.media_paths is
  'Ordered Storage paths for an automation carousel. Empty for text, single-media images, and videos.';
