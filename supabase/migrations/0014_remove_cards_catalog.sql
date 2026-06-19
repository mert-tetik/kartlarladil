alter table public.user_cards
  alter column card_source_key set not null;

alter table public.practice_attempts
  alter column card_source_key set not null;

alter table public.user_cards
  drop constraint if exists user_cards_card_id_fkey;

alter table public.practice_attempts
  drop constraint if exists practice_attempts_card_id_fkey;

alter table public.user_cards
  drop constraint if exists user_cards_pkey;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_cards'::regclass
      and conname = 'user_cards_pkey'
  ) then
    alter table public.user_cards
      add constraint user_cards_pkey primary key (user_id, card_source_key);
  end if;
end
$$;

alter table public.user_cards
  drop column if exists card_id;

alter table public.practice_attempts
  drop column if exists card_id;

drop index if exists public.user_cards_user_card_source_key_idx;
drop index if exists public.cards_language_tier_idx;
drop index if exists public.cards_term_trgm_idx;
drop index if exists public.cards_term_kind_idx;

do $$
begin
  if to_regclass('public.cards') is not null then
    revoke select on public.cards from anon, authenticated;
    drop policy if exists "Cards are public" on public.cards;
    drop table public.cards;
  end if;
end
$$;
