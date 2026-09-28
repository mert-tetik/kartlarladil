alter table public.shared_card_grammar
  add column if not exists identity_key text,
  add column if not exists grammar_format_version text;

-- Existing rows were created with format/translation/part-of-speech values in
-- the hash. Mark them as legacy so the first request after this migration
-- regenerates the single retained row with the current structured format.
update public.shared_card_grammar
set grammar_format_version = 'legacy'
where grammar_format_version is null;

update public.shared_card_grammar
set identity_key = concat_ws(
  chr(31),
  source_language,
  native_locale,
  lower(regexp_replace(btrim(term), '\s+', ' ', 'g')),
  term_kind
)
where identity_key is null;

-- Keep the newest usable cache row for each natural card identity. The cache
-- is derived data, so historical duplicate generations can be safely removed.
with ranked_rows as (
  select
    ctid,
    row_number() over (
      partition by identity_key
      order by
        case when status = 'ready' and grammar_text is not null then 0 else 1 end,
        updated_at desc nulls last,
        created_at desc nulls last,
        cache_key
    ) as row_number
  from public.shared_card_grammar
)
delete from public.shared_card_grammar as grammar
using ranked_rows
where grammar.ctid = ranked_rows.ctid
  and ranked_rows.row_number > 1;

alter table public.shared_card_grammar
  alter column identity_key set not null,
  alter column grammar_format_version set default 'structured-sections-v8',
  alter column grammar_format_version set not null;

create unique index if not exists shared_card_grammar_identity_key_uidx
  on public.shared_card_grammar(identity_key);
