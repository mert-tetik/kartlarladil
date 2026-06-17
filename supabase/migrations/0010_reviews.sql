create extension if not exists pgcrypto;

-- User reviews and ratings for FoxiesDeck.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists reviews_user_id_idx on public.reviews(user_id);
create index if not exists reviews_created_at_idx on public.reviews(created_at desc);

grant select on public.reviews to anon, authenticated;
grant insert, update on public.reviews to authenticated;

alter table public.reviews enable row level security;

-- Reviews are public so aggregate stats can be shown on the landing page.
create policy "Reviews are public"
  on public.reviews for select
  to anon, authenticated
  using (true);

create policy "Users insert own review"
  on public.reviews for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update own review"
  on public.reviews for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
