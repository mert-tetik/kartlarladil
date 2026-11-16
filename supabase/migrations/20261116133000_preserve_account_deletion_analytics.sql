-- Keep the aggregate account-deletion event after the auth row is removed.
-- Analytics rows remain service-role-only and contain no account identifiers
-- beyond the nullable foreign key that is cleared on deletion.

alter table public.analytics_events
  alter column user_id drop not null;

alter table public.analytics_events
  drop constraint if exists analytics_events_user_id_fkey;

alter table public.analytics_events
  add constraint analytics_events_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
