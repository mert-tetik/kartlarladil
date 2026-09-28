create table if not exists public.shared_card_grammar (
  cache_key text primary key,
  source_language text not null,
  native_locale text not null,
  term text not null,
  native_translation text not null,
  part_of_speech text not null default '',
  term_kind text not null default 'word',
  grammar_text text,
  status text not null default 'processing',
  generated_by uuid references auth.users(id) on delete set null,
  processing_started_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shared_card_grammar_source_language_check
    check (source_language in ('tr', 'en', 'de', 'ru', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ar', 'ja', 'ko', 'zh-CN')),
  constraint shared_card_grammar_native_locale_check
    check (native_locale in ('tr', 'en', 'de', 'ru', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ar', 'ja', 'ko', 'zh-CN')),
  constraint shared_card_grammar_term_kind_check
    check (term_kind in ('word', 'fixed_phrase')),
  constraint shared_card_grammar_status_check
    check (status in ('processing', 'ready', 'failed')),
  constraint shared_card_grammar_text_length_check
    check (grammar_text is null or char_length(grammar_text) <= 6000)
);

create index if not exists shared_card_grammar_processing_idx
  on public.shared_card_grammar(status, processing_started_at);

alter table public.shared_card_grammar enable row level security;

-- The shared cache is intentionally not directly queryable or writable from a
-- browser. The authenticated API route validates ownership/preview data and
-- uses the service role for the common cache.
revoke all on table public.shared_card_grammar from public, anon, authenticated;
grant all on table public.shared_card_grammar to service_role;
