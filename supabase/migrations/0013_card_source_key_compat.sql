alter table public.user_cards
  add column if not exists card_source_key text;

alter table public.practice_attempts
  add column if not exists card_source_key text;

do $$
begin
  if to_regclass('public.cards') is not null then
    update public.user_cards as user_cards
    set card_source_key = cards.source_key
    from public.cards as cards
    where user_cards.card_source_key is null
      and user_cards.card_id = cards.id;

    update public.practice_attempts as practice_attempts
    set card_source_key = cards.source_key
    from public.cards as cards
    where practice_attempts.card_source_key is null
      and practice_attempts.card_id = cards.id;
  end if;
end
$$;

alter table public.user_cards
  drop constraint if exists user_cards_card_source_key_not_blank;

alter table public.user_cards
  add constraint user_cards_card_source_key_not_blank
  check (card_source_key is null or btrim(card_source_key) <> '');

alter table public.practice_attempts
  drop constraint if exists practice_attempts_card_source_key_not_blank;

alter table public.practice_attempts
  add constraint practice_attempts_card_source_key_not_blank
  check (card_source_key is null or btrim(card_source_key) <> '');

create unique index if not exists user_cards_user_card_source_key_idx
  on public.user_cards(user_id, card_source_key)
  where card_source_key is not null;

create index if not exists practice_attempts_user_card_source_key_idx
  on public.practice_attempts(user_id, card_source_key);
