-- Durable daily generation checkpoints.
-- A production generation can be resumed safely because every planned output
-- gets a deterministic id before any provider or renderer is called.
alter table public.social_content_automation_outputs
  add column if not exists generation_key text,
  add column if not exists generation_date date,
  add column if not exists generation_index smallint,
  add column if not exists title text,
  add column if not exists description text;

create unique index if not exists social_content_automation_outputs_generation_key_uidx
  on public.social_content_automation_outputs (generation_key)
  where generation_key is not null;

create index if not exists social_content_automation_outputs_generation_date_idx
  on public.social_content_automation_outputs (generation_date, created_at desc)
  where generation_date is not null;

comment on column public.social_content_automation_outputs.generation_key is
  'Stable owner/date/combo/type/index key used to resume a daily generation without duplicating output.';
comment on column public.social_content_automation_outputs.generation_date is
  'The Istanbul calendar date for which this output was planned.';
comment on column public.social_content_automation_outputs.generation_index is
  'One-based ordinal inside the language-combination and content-type pool for the generation date.';
comment on column public.social_content_automation_outputs.title is
  'Durable social title stored with the generated output.';
comment on column public.social_content_automation_outputs.description is
  'Durable social description/caption stored with the generated output.';
