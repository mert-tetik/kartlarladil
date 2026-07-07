-- Kullanıcı segmentleri için genel istatistikler
-- Çalıştırma: Supabase SQL Editor veya psql

WITH user_card_tiers AS (
  -- Her kullanıcı kartı için tier çözümle
  SELECT
    uc.user_id,
    uc.status,
    COALESCE(
      cc.tier,
      CASE
        WHEN split_part(uc.card_source_key, ':', 2) IN ('A1', 'A2', 'B1', 'B2', 'C1')
        THEN split_part(uc.card_source_key, ':', 2)
        ELSE NULL
      END
    ) AS tier
  FROM user_cards uc
  LEFT JOIN custom_cards cc ON cc.source_key = uc.card_source_key
),

user_stats AS (
  SELECT
    user_id,
    COUNT(*) FILTER (WHERE status = 'active') AS active_count,
    COUNT(*) FILTER (WHERE status = 'learned') AS learned_count,
    SUM(
      CASE
        WHEN status = 'learned' THEN
          CASE tier
            WHEN 'A1' THEN 10
            WHEN 'A2' THEN 20
            WHEN 'B1' THEN 40
            WHEN 'B2' THEN 50
            WHEN 'C1' THEN 100
            ELSE 0
          END
        ELSE 0
      END
    ) AS total_points
  FROM user_card_tiers
  GROUP BY user_id
),

ai_points AS (
  SELECT
    user_id,
    COALESCE(ai_practice_points, 0) AS ai_points
  FROM user_profiles
)

SELECT
  (SELECT COUNT(*) FROM user_profiles) AS total_users,
  COUNT(DISTINCT us.user_id) FILTER (WHERE us.active_count > 10) AS active_cards_over_10,
  COUNT(DISTINCT us.user_id) FILTER (WHERE us.learned_count > 10) AS learned_cards_over_10,
  COUNT(DISTINCT us.user_id) FILTER (WHERE us.learned_count > 20) AS learned_cards_over_20,
  COUNT(DISTINCT us.user_id) FILTER (WHERE us.total_points > 100) AS total_points_over_100,
  COUNT(DISTINCT ap.user_id) FILTER (WHERE ap.ai_points >= 100) AS ai_and_game_points_over_100
FROM user_profiles p
LEFT JOIN user_stats us ON us.user_id = p.user_id
LEFT JOIN ai_points ap ON ap.user_id = p.user_id;
