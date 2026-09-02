alter table public.custom_cards
  add column if not exists definitions jsonb not null default '{}'::jsonb;

comment on column public.custom_cards.definitions is
  'Short GPT-generated definitions keyed by supported locale for definition quiz questions.';
