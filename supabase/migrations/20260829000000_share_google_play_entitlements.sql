-- A Google Play subscription is owned by the Play purchase token, not by one
-- FoxiesDeck login. Each authenticated FoxiesDeck account that restores the
-- same verified purchase gets its own local entitlement row.

create table if not exists public.google_play_purchase_accounts (
  purchase_token text not null references public.google_play_purchase_tokens(purchase_token) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (purchase_token, user_id)
);

create index if not exists google_play_purchase_accounts_user_idx
  on public.google_play_purchase_accounts(user_id);

alter table public.google_play_purchase_accounts enable row level security;
revoke all on table public.google_play_purchase_accounts from anon, authenticated;
grant all on table public.google_play_purchase_accounts to service_role;

insert into public.google_play_purchase_accounts (purchase_token, user_id)
select purchase_token, user_id
from public.google_play_purchase_tokens
on conflict (purchase_token, user_id) do nothing;
