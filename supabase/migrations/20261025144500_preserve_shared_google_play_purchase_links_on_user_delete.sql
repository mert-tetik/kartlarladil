begin;

-- A verified Google Play purchase may be restored by multiple FoxiesDeck
-- accounts. The token registry must therefore outlive the account that first
-- claimed it; deleting that account must not cascade-delete mappings owned by
-- other accounts and silently stop their RTDN updates.
alter table public.google_play_purchase_tokens
  alter column user_id drop not null;

alter table public.google_play_purchase_tokens
  drop constraint google_play_purchase_tokens_user_id_fkey;

alter table public.google_play_purchase_tokens
  add constraint google_play_purchase_tokens_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete set null;

-- Fail the migration if the token registry can still be deleted with its
-- original account or if its ownership pointer is not nullable.
do $$
declare
  user_id_is_not_null boolean;
  user_id_delete_action text;
begin
  select attribute.attnotnull
  into user_id_is_not_null
  from pg_attribute as attribute
  where attribute.attrelid = 'public.google_play_purchase_tokens'::regclass
    and attribute.attname = 'user_id'
    and not attribute.attisdropped;

  select constraint_row.confdeltype::text
  into user_id_delete_action
  from pg_constraint as constraint_row
  where constraint_row.conrelid = 'public.google_play_purchase_tokens'::regclass
    and constraint_row.conname = 'google_play_purchase_tokens_user_id_fkey';

  if user_id_is_not_null is distinct from false
    or user_id_delete_action is distinct from 'n' then
    raise exception 'subscription_security_check_failed: purchase_token_account_delete_behavior';
  end if;
end;
$$;

commit;
