-- Allow the "create_card" and "quiz_validate" event types in the AI usage events table.
-- These were added in the application types but missing from the database constraint.

alter table public.ai_usage_events
  drop constraint if exists ai_usage_events_event_type_check;

alter table public.ai_usage_events
  add constraint ai_usage_events_event_type_check
  check (event_type in ('chat', 'translate', 'ask', 'create_card', 'quiz_validate'));
