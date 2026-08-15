-- Automation state originally stored a JSON array of groups. The UI now stores
-- groups and superGroups together in one object; allow both shapes so existing
-- saved automations remain readable while the new format can be persisted.
alter table public.social_content_automation_state
  drop constraint if exists social_content_automation_state_groups_check;

alter table public.social_content_automation_state
  add constraint social_content_automation_state_groups_check
  check (jsonb_typeof(groups) in ('array', 'object'));
