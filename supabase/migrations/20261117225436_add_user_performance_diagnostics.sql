-- Optional, account-linked Android performance diagnostics. The app server is
-- the only writer; users cannot access these records through the Data API.
create table if not exists public.user_performance_diagnostics_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  policy_version text not null,
  consented_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_performance_diagnostics_consent_timestamp_check
    check ((enabled and consented_at is not null) or not enabled)
);

create table if not exists public.user_performance_summaries (
  user_id uuid not null references auth.users(id) on delete cascade,
  environment_key text not null check (environment_key ~ '^[a-f0-9]{64}$'),
  manufacturer text not null default '',
  device_model text not null default '',
  android_release text not null default '',
  android_api_level integer not null check (android_api_level between 24 and 100),
  app_version text not null default '',
  webview_package text not null default '',
  webview_version text not null default '',
  max_startup_ms integer not null default 0 check (max_startup_ms >= 0),
  startup_stage_max_ms jsonb not null default '{}'::jsonb
    check (jsonb_typeof(startup_stage_max_ms) = 'object'),
  max_navigation_ms integer not null default 0 check (max_navigation_ms >= 0),
  max_navigation_route text not null default '',
  fps_weighted_sum double precision not null default 0 check (fps_weighted_sum >= 0),
  fps_sample_duration_ms bigint not null default 0 check (fps_sample_duration_ms >= 0),
  janky_frame_count bigint not null default 0 check (janky_frame_count >= 0),
  rendered_frame_count bigint not null default 0 check (rendered_frame_count >= 0),
  launch_sample_count bigint not null default 0 check (launch_sample_count >= 0),
  navigation_sample_count bigint not null default 0 check (navigation_sample_count >= 0),
  fps_sample_count bigint not null default 0 check (fps_sample_count >= 0),
  processed_event_ids uuid[] not null default '{}',
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, environment_key),
  constraint user_performance_summaries_event_ids_limit
    check (cardinality(processed_event_ids) <= 512)
);

create index if not exists user_performance_summaries_user_id_idx
  on public.user_performance_summaries (user_id);

alter table public.user_performance_diagnostics_settings enable row level security;
alter table public.user_performance_summaries enable row level security;
revoke all on table public.user_performance_diagnostics_settings from public, anon, authenticated;
revoke all on table public.user_performance_summaries from public, anon, authenticated;
grant all on table public.user_performance_diagnostics_settings to service_role;
grant all on table public.user_performance_summaries to service_role;

create or replace function public.merge_performance_stage_maxima(p_existing jsonb, p_incoming jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select coalesce(
    jsonb_object_agg(
      stage_key,
      to_jsonb(greatest(
        coalesce((p_existing ->> stage_key)::bigint, 0),
        coalesce((p_incoming ->> stage_key)::bigint, 0)
      ))
    ),
    '{}'::jsonb
  )
  from (
    select jsonb_object_keys(coalesce(p_existing, '{}'::jsonb)) as stage_key
    union
    select jsonb_object_keys(coalesce(p_incoming, '{}'::jsonb)) as stage_key
  ) as stages;
$$;

revoke all on function public.merge_performance_stage_maxima(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.merge_performance_stage_maxima(jsonb, jsonb) to service_role;

create or replace function public.record_user_performance_diagnostic(
  p_user_id uuid,
  p_event_id uuid,
  p_environment_key text,
  p_device jsonb,
  p_metrics jsonb
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  insert into public.user_performance_summaries (
    user_id,
    environment_key,
    manufacturer,
    device_model,
    android_release,
    android_api_level,
    app_version,
    webview_package,
    webview_version,
    max_startup_ms,
    startup_stage_max_ms,
    max_navigation_ms,
    max_navigation_route,
    fps_weighted_sum,
    fps_sample_duration_ms,
    janky_frame_count,
    rendered_frame_count,
    launch_sample_count,
    navigation_sample_count,
    fps_sample_count,
    processed_event_ids
  ) values (
    p_user_id,
    p_environment_key,
    coalesce(p_device ->> 'manufacturer', ''),
    coalesce(p_device ->> 'model', ''),
    coalesce(p_device ->> 'android_release', ''),
    (p_device ->> 'android_api_level')::integer,
    coalesce(p_device ->> 'app_version', ''),
    coalesce(p_device ->> 'webview_package', ''),
    coalesce(p_device ->> 'webview_version', ''),
    coalesce((p_metrics ->> 'startup_ms')::integer, 0),
    coalesce(p_metrics -> 'startup_stage_ms', '{}'::jsonb),
    coalesce((p_metrics ->> 'navigation_ms')::integer, 0),
    coalesce(p_metrics ->> 'navigation_route', ''),
    coalesce((p_metrics ->> 'fps_average')::double precision, 0)
      * coalesce((p_metrics ->> 'fps_duration_ms')::bigint, 0),
    coalesce((p_metrics ->> 'fps_duration_ms')::bigint, 0),
    coalesce((p_metrics ->> 'janky_frames')::bigint, 0),
    coalesce((p_metrics ->> 'rendered_frames')::bigint, 0),
    case when p_metrics ? 'startup_ms' then 1 else 0 end,
    case when p_metrics ? 'navigation_ms' then 1 else 0 end,
    case when p_metrics ? 'fps_average' then 1 else 0 end,
    array[p_event_id]
  )
  on conflict (user_id, environment_key) do update set
    manufacturer = excluded.manufacturer,
    device_model = excluded.device_model,
    android_release = excluded.android_release,
    android_api_level = excluded.android_api_level,
    app_version = excluded.app_version,
    webview_package = excluded.webview_package,
    webview_version = excluded.webview_version,
    max_startup_ms = greatest(user_performance_summaries.max_startup_ms, excluded.max_startup_ms),
    startup_stage_max_ms = public.merge_performance_stage_maxima(
      user_performance_summaries.startup_stage_max_ms,
      excluded.startup_stage_max_ms
    ),
    max_navigation_ms = greatest(user_performance_summaries.max_navigation_ms, excluded.max_navigation_ms),
    max_navigation_route = case
      when excluded.max_navigation_ms > user_performance_summaries.max_navigation_ms
        then excluded.max_navigation_route
      else user_performance_summaries.max_navigation_route
    end,
    fps_weighted_sum = user_performance_summaries.fps_weighted_sum + excluded.fps_weighted_sum,
    fps_sample_duration_ms = user_performance_summaries.fps_sample_duration_ms + excluded.fps_sample_duration_ms,
    janky_frame_count = user_performance_summaries.janky_frame_count + excluded.janky_frame_count,
    rendered_frame_count = user_performance_summaries.rendered_frame_count + excluded.rendered_frame_count,
    launch_sample_count = user_performance_summaries.launch_sample_count + excluded.launch_sample_count,
    navigation_sample_count = user_performance_summaries.navigation_sample_count + excluded.navigation_sample_count,
    fps_sample_count = user_performance_summaries.fps_sample_count + excluded.fps_sample_count,
    processed_event_ids = (
      array_append(user_performance_summaries.processed_event_ids, p_event_id)
    )[greatest(cardinality(user_performance_summaries.processed_event_ids) - 510, 1):],
    last_seen_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where not (p_event_id = any(user_performance_summaries.processed_event_ids));
end;
$$;

revoke all on function public.record_user_performance_diagnostic(uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.record_user_performance_diagnostic(uuid, uuid, text, jsonb, jsonb) to service_role;
