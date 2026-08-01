-- Automation media is temporary, but AI videos can exceed the previous image-only limit.
update storage.buckets
set
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = array[
    'image/webp',
    'image/png',
    'image/jpeg',
    'video/mp4',
    'video/webm'
  ]::text[]
where id = 'social-studio-automation';
