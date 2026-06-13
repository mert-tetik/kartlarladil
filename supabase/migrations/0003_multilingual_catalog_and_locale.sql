alter table public.languages
  drop constraint if exists languages_code_check;

alter table public.languages
  add constraint languages_code_check
  check (code in ('tr', 'en', 'de', 'ru', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ar', 'ja', 'ko', 'zh-CN'));

alter table public.cards
  drop constraint if exists cards_language_code_fkey;

alter table public.cards
  add constraint cards_language_code_fkey
  foreign key (language_code)
  references public.languages(code)
  on update cascade
  on delete restrict;

alter table public.cards
  add column if not exists term_kind text not null default 'word'
    check (term_kind in ('word', 'fixed_phrase')),
  add column if not exists translations jsonb not null default '{}'::jsonb
    check (jsonb_typeof(translations) = 'object'),
  add column if not exists grammar_i18n jsonb not null default '{}'::jsonb
    check (jsonb_typeof(grammar_i18n) = 'object');

alter table public.user_profiles
  add column if not exists preferred_ui_locale text not null default 'tr'
    check (preferred_ui_locale in ('tr', 'en', 'de', 'ru', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ar', 'ja', 'ko', 'zh-CN'));

create index if not exists cards_term_kind_idx on public.cards(term_kind);
create index if not exists user_profiles_ui_locale_idx on public.user_profiles(preferred_ui_locale);

grant select on public.languages, public.cards to anon, authenticated;
grant select, insert, update on public.user_profiles to authenticated;
