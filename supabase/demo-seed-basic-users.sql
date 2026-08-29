-- Demo/basic leaderboard users.
-- This script writes directly to auth.users for ad-hoc seeding in local/staging.
-- Run it from the Supabase SQL editor or psql with a privileged role.

begin;

create extension if not exists pgcrypto;

with raw_demo_users (
  user_index,
  display_name,
  email,
  preferred_language_code,
  preferred_ui_locale,
  preferred_tier,
  theme,
  learned_budget,
  ai_practice_points,
  chest_points,
  streak_points,
  mission_points,
  active_card_count
) as (
  values
    (1,  'Elif Kaya',      'elif.kaya.demo@foxiesdeck.test',      'en',    'tr',    'B2',  'rose-dark',    1220, 180, 140,  90,  70,  8),
    (2,  'Arda Demir',     'arda.demir.demo@foxiesdeck.test',     'de',    'tr',    'B1',  'ocean',        1100, 160, 120,  80,  60,  7),
    (3,  'Zeynep Aydin',   'zeynep.aydin.demo@foxiesdeck.test',   'fr',    'en',    'A2',  'emerald-dark',  980, 150, 100,  65,  55,  7),
    (4,  'Kerem Sahin',    'kerem.sahin.demo@foxiesdeck.test',    'es',    'tr',    'B2',  'amber-dark',    920, 120, 110,  75,  40,  6),
    (5,  'Melis Yilmaz',   'melis.yilmaz.demo@foxiesdeck.test',   'it',    'tr',    'B1',  'teal',          860, 130,  90,  55,  65,  6),
    (6,  'Sofia Mendes',   'sofia.mendes.demo@foxiesdeck.test',   'pt',    'pt',    'A2',  'violet-dark',   780, 100,  80,  60,  50,  6),
    (7,  'Luca Ferri',     'luca.ferri.demo@foxiesdeck.test',     'it',    'it',    'B1',  'crimson',       740,  95,  60,  45,  40,  5),
    (8,  'Nadia Petrova',  'nadia.petrova.demo@foxiesdeck.test',  'ru',    'ru',    'B2',  'indigo-dark',   700,  70,  75,  35,  30,  5),
    (9,  'Jonas Weber',    'jonas.weber.demo@foxiesdeck.test',    'de',    'de',    'all', 'ocean-dark',    640,  85,  60,  40,  45,  5),
    (10, 'Claire Moreau',  'claire.moreau.demo@foxiesdeck.test',  'fr',    'fr',    'A2',  'rose',          560,  60,  50,  30,  25,  4),
    (11, 'Mateo Alvarez',  'mateo.alvarez.demo@foxiesdeck.test',  'es',    'es',    'B1',  'amber',         520,  55,  45,  25,  30,  4),
    (12, 'Hana Kim',       'hana.kim.demo@foxiesdeck.test',       'ko',    'ko',    'A1',  'lime-dark',     460,  40,  35,  25,  20,  4),
    (13, 'Kenji Sato',     'kenji.sato.demo@foxiesdeck.test',     'ja',    'ja',    'A2',  'indigo',        400,  35,  30,  20,  20,  4),
    (14, 'Layla Haddad',   'layla.haddad.demo@foxiesdeck.test',   'ar',    'ar',    'A1',  'emerald',       320,  25,  20,  15,  15,  3),
    (15, 'Mila Novak',     'mila.novak.demo@foxiesdeck.test',     'nl',    'en',    'A1',  'default-dark',  240,  20,  15,  10,  10,  3)
),
demo_users as (
  select
    user_index,
    display_name,
    lower(email) as email,
    preferred_language_code,
    preferred_ui_locale,
    preferred_tier,
    theme,
    learned_budget,
    ai_practice_points,
    chest_points,
    streak_points,
    mission_points,
    active_card_count,
    (
      substr(md5(lower(email)), 1, 8) || '-' ||
      substr(md5(lower(email)), 9, 4) || '-' ||
      '4' || substr(md5(lower(email)), 14, 3) || '-' ||
      'a' || substr(md5(lower(email)), 18, 3) || '-' ||
      substr(md5(lower(email)), 21, 12)
    )::uuid as seed_user_id
  from raw_demo_users
),
seed_users as (
  select
    demo.user_index,
    demo.display_name,
    demo.email,
    demo.preferred_language_code,
    demo.preferred_ui_locale,
    demo.preferred_tier,
    demo.theme,
    demo.learned_budget,
    demo.ai_practice_points,
    demo.chest_points,
    demo.streak_points,
    demo.mission_points,
    demo.active_card_count,
    coalesce(existing.id, demo.seed_user_id) as user_id,
    now() - make_interval(days => demo.user_index * 3) as base_created_at
  from demo_users demo
  left join auth.users existing
    on lower(existing.email) = demo.email
),
insert_auth_users as (
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    confirmed_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    is_anonymous
  )
  select
    '00000000-0000-0000-0000-000000000000'::uuid,
    user_id,
    'authenticated',
    'authenticated',
    email,
    crypt('DemoPass!2026', gen_salt('bf')),
    base_created_at,
    null,
    '',
    null,
    '',
    null,
    '',
    '',
    null,
    base_created_at,
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('display_name', display_name),
    false,
    base_created_at,
    base_created_at,
    null,
    null,
    '',
    '',
    null,
    base_created_at,
    '',
    0,
    null,
    '',
    null,
    false,
    null,
    false
  from seed_users
  where not exists (
    select 1
    from auth.users existing
    where lower(existing.email) = seed_users.email
  )
  returning id
),
cleanup_practice_attempts as (
  delete from public.practice_attempts
  where user_id in (select user_id from seed_users)
  returning user_id
),
cleanup_ai_scores as (
  delete from public.ai_practice_scores
  where user_id in (select user_id from seed_users)
  returning user_id
),
cleanup_quiz_streak_rewards as (
  delete from public.quiz_streak_rewards
  where user_id in (select user_id from seed_users)
  returning user_id
),
cleanup_chest_rewards as (
  delete from public.chest_rewards
  where user_id in (select user_id from seed_users)
  returning user_id
),
cleanup_mission_rewards as (
  delete from public.mission_rewards
  where user_id in (select user_id from seed_users)
  returning user_id
),
cleanup_user_missions as (
  delete from public.user_missions
  where user_id in (select user_id from seed_users)
  returning user_id
),
cleanup_notification_logs as (
  delete from public.notification_logs
  where user_id in (select user_id from seed_users)
  returning user_id
),
cleanup_push_subscriptions as (
  delete from public.push_subscriptions
  where user_id in (select user_id from seed_users)
  returning user_id
),
cleanup_user_cards as (
  delete from public.user_cards
  where user_id in (select user_id from seed_users)
  returning user_id
),
upsert_profiles as (
  insert into public.user_profiles (
    user_id,
    display_name,
    preferred_language_code,
    preferred_ui_locale,
    preferred_tier,
    onboarding_completed,
    ai_practice_points,
    chest_points,
    streak_points,
    mission_points,
    quiz_result_points,
    push_marketing_enabled,
    leaderboard_visible,
    theme,
    created_at,
    updated_at
  )
  select
    user_id,
    display_name,
    preferred_language_code,
    preferred_ui_locale,
    preferred_tier,
    true,
    ai_practice_points,
    chest_points,
    streak_points,
    mission_points,
    0,
    false,
    true,
    theme,
    base_created_at,
    now()
  from seed_users
  on conflict (user_id) do update
  set
    display_name = excluded.display_name,
    preferred_language_code = excluded.preferred_language_code,
    preferred_ui_locale = excluded.preferred_ui_locale,
    preferred_tier = excluded.preferred_tier,
    onboarding_completed = excluded.onboarding_completed,
    ai_practice_points = excluded.ai_practice_points,
    chest_points = excluded.chest_points,
    streak_points = excluded.streak_points,
    mission_points = excluded.mission_points,
    quiz_result_points = excluded.quiz_result_points,
    push_marketing_enabled = excluded.push_marketing_enabled,
    leaderboard_visible = excluded.leaderboard_visible,
    theme = excluded.theme,
    updated_at = excluded.updated_at
  returning user_id
),
upsert_subscriptions as (
  insert into public.user_subscriptions (
    user_id,
    plan,
    status,
    provider,
    display_name,
    lemon_squeezy_customer_id,
    lemon_squeezy_subscription_id,
    lemon_squeezy_variant_id,
    lemon_squeezy_product_id,
    customer_portal_url,
    google_play_purchase_token,
    google_play_subscription_id,
    google_play_order_id,
    renews_at,
    ends_at,
    created_at,
    updated_at
  )
  select
    user_id,
    'basic',
    'active',
    'lemon_squeezy',
    display_name,
    'demo-customer-' || lpad(user_index::text, 2, '0'),
    'demo-basic-sub-' || lpad(user_index::text, 2, '0'),
    'demo-basic-monthly',
    'demo-product-basic',
    null,
    null,
    null,
    null,
    now() + make_interval(days => 30 + user_index),
    null,
    base_created_at,
    now()
  from seed_users
  on conflict (user_id) do update
  set
    plan = excluded.plan,
    status = excluded.status,
    provider = excluded.provider,
    display_name = excluded.display_name,
    lemon_squeezy_customer_id = excluded.lemon_squeezy_customer_id,
    lemon_squeezy_subscription_id = excluded.lemon_squeezy_subscription_id,
    lemon_squeezy_variant_id = excluded.lemon_squeezy_variant_id,
    lemon_squeezy_product_id = excluded.lemon_squeezy_product_id,
    customer_portal_url = excluded.customer_portal_url,
    google_play_purchase_token = excluded.google_play_purchase_token,
    google_play_subscription_id = excluded.google_play_subscription_id,
    google_play_order_id = excluded.google_play_order_id,
    renews_at = excluded.renews_at,
    ends_at = excluded.ends_at,
    updated_at = excluded.updated_at
  returning user_id
),
sample_cards (
  language,
  tier,
  english_key,
  part_of_speech,
  point_value
) as (
  values
    ('en',    'A1', 'about',        'adverb',    10),
    ('de',    'A1', 'about',        'adverb',    10),
    ('es',    'A1', 'above',        'adverb',    10),
    ('fr',    'A1', 'across',       'adverb',    10),
    ('it',    'A1', 'action',       'noun',      10),
    ('pt',    'A1', 'activity',     'noun',      10),
    ('nl',    'A1', 'actor',        'noun',      10),
    ('pl',    'A1', 'actress',      'noun',      10),
    ('tr',    'A1', 'add',          'verb',      10),
    ('ru',    'A1', 'about',        'adverb',    10),
    ('ja',    'A1', 'activity',     'noun',      10),
    ('ko',    'A1', 'action',       'noun',      10),

    ('en',    'A2', 'ability',      'noun',      20),
    ('de',    'A2', 'able',         'adjective', 20),
    ('es',    'A2', 'abroad',       'adverb',    20),
    ('fr',    'A2', 'accept',       'verb',      20),
    ('it',    'A2', 'accident',     'noun',      20),
    ('pt',    'A2', 'achieve',      'verb',      20),
    ('nl',    'A2', 'active',       'adjective', 20),
    ('pl',    'A2', 'actually',     'adverb',    20),
    ('tr',    'A2', 'accept',       'verb',      20),
    ('ru',    'A2', 'ability',      'noun',      20),
    ('ja',    'A2', 'achieve',      'verb',      20),
    ('zh-CN', 'A2', 'active',       'adjective', 20),

    ('en',    'B1', 'absolutely',   'adverb',    40),
    ('de',    'B1', 'academic',     'adjective', 40),
    ('es',    'B1', 'access',       'noun',      40),
    ('fr',    'B1', 'account',      'noun',      40),
    ('it',    'B1', 'achievement',  'noun',      40),
    ('pt',    'B1', 'ad',           'noun',      40),
    ('nl',    'B1', 'addition',     'noun',      40),
    ('pl',    'B1', 'absolutely',   'adverb',    40),
    ('tr',    'B1', 'account',      'noun',      40),
    ('ru',    'B1', 'academic',     'adjective', 40),
    ('ja',    'B1', 'access',       'noun',      40),
    ('ar',    'B1', 'achievement',  'noun',      40),

    ('en',    'B2', 'abandon',      'verb',      50),
    ('de',    'B2', 'absolute',     'adjective', 50),
    ('es',    'B2', 'acceptable',   'adjective', 50),
    ('fr',    'B2', 'accompany',    'verb',      50),
    ('it',    'B2', 'accurate',     'adjective', 50),
    ('pt',    'B2', 'accuse',       'verb',      50),
    ('nl',    'B2', 'acquire',      'verb',      50),
    ('pl',    'B2', 'adapt',        'verb',      50),
    ('tr',    'B2', 'additional',   'adjective', 50),
    ('ru',    'B2', 'acknowledge',  'verb',      50),
    ('ja',    'B2', 'abandon',      'verb',      50),
    ('ko',    'B2', 'absolute',     'adjective', 50),
    ('zh-CN', 'B2', 'acceptable',   'adjective', 50),
    ('ar',    'B2', 'accompany',    'verb',      50),
    ('en',    'B2', 'acquire',      'verb',      50),
    ('de',    'B2', 'adapt',        'verb',      50),
    ('es',    'B2', 'additional',   'adjective', 50),
    ('fr',    'B2', 'acknowledge',  'verb',      50)
),
sample_card_pool as (
  select
    language || ':' || tier || ':word:' || english_key || ':' || part_of_speech as source_key,
    tier,
    point_value
  from sample_cards
),
learned_candidates as (
  select
    user_id,
    email,
    user_index,
    base_created_at,
    learned_budget,
    source_key,
    tier,
    point_value,
    row_number() over (
      partition by user_id
      order by md5(email || ':learned:' || source_key)
    ) as order_in_user,
    sum(point_value) over (
      partition by user_id
      order by md5(email || ':learned:' || source_key)
    ) as running_points
  from seed_users
  cross join sample_card_pool
),
learned_cards as (
  select
    user_id,
    source_key,
    tier,
    base_created_at,
    order_in_user
  from learned_candidates
  where running_points <= learned_budget
),
active_candidates as (
  select
    users.user_id,
    users.email,
    users.user_index,
    users.base_created_at,
    users.active_card_count,
    cards.source_key,
    cards.tier,
    row_number() over (
      partition by users.user_id
      order by md5(users.email || ':active:' || cards.source_key)
    ) as order_in_user
  from seed_users users
  join sample_card_pool cards
    on true
  left join learned_cards learned
    on learned.user_id = users.user_id
   and learned.source_key = cards.source_key
  where learned.source_key is null
),
active_cards as (
  select
    user_id,
    source_key,
    tier,
    base_created_at,
    order_in_user
  from active_candidates
  where order_in_user <= active_card_count
),
insert_user_cards as (
  insert into public.user_cards (
    user_id,
    card_source_key,
    status,
    correct_count,
    added_at,
    learned_at
  )
  select
    user_id,
    source_key,
    'learned',
    case tier
      when 'A1' then 4
      when 'A2' then 4
      when 'B1' then 6
      when 'B2' then 6
      else 8
    end,
    base_created_at + make_interval(hours => order_in_user::int),
    base_created_at + make_interval(days => 1, hours => order_in_user::int)
  from learned_cards

  union all

  select
    user_id,
    source_key,
    'active',
    case tier
      when 'A1' then 1
      when 'A2' then 1
      when 'B1' then 2
      when 'B2' then 2
      else 3
    end,
    base_created_at + make_interval(days => 2, hours => order_in_user::int),
    null
  from active_cards

  on conflict (user_id, card_source_key) do update
  set
    status = excluded.status,
    correct_count = excluded.correct_count,
    added_at = excluded.added_at,
    learned_at = excluded.learned_at
  returning user_id
)
select
  user_id,
  display_name,
  email,
  ai_practice_points,
  chest_points,
  streak_points,
  mission_points,
  0 as quiz_result_points,
  learned_budget
from seed_users
order by user_index;

commit;
