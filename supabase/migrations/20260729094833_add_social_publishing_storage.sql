-- Instagram's content publishing API fetches an image from a public HTTPS URL.
-- This bucket is service-role only for writes; each generated object gets an
-- unguessable path and is removed after Meta has finished ingesting it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-publishing',
  'social-publishing',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

revoke all on storage.objects from anon, authenticated;
grant select, insert, update, delete on storage.objects to service_role;
