-- Allow the "quiz_validate" event type in the AI usage events table.
-- This lets the Learn text-answer AI validation feature consume the same AI quota
-- as other AI features instead of using a separate localStorage limit.

alter table public.ai_usage_events
  drop constraint if exists ai_usage_events_event_type_check;

alter table public.ai_usage_events
  add constraint ai_usage_events_event_type_check
  check (event_type in ('chat', 'translate', 'ask', 'create_card', 'quiz_validate'));
