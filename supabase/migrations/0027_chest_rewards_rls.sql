-- Ensure chest_rewards has RLS policies so mission chest claims can insert.
-- Some environments had the table created without policies, causing authenticated inserts to fail.
alter table public.chest_rewards enable row level security;

grant select, insert on public.chest_rewards to authenticated;

drop policy if exists chest_rewards_select_own on public.chest_rewards;
create policy chest_rewards_select_own
  on public.chest_rewards
  for select
  to authenticated
  using (auth.uid() = user_id); 

drop policy if exists chest_rewards_insert_own on public.chest_rewards;
create policy chest_rewards_insert_own
  on public.chest_rewards
  for insert
  to authenticated
  with check (auth.uid() = user_id);   
