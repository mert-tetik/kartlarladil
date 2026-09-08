import "server-only";

import type { User } from "@supabase/supabase-js";
import { VOCABULARY_CARDS } from "@/data/cards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRankForPoints, TIER_POINTS } from "@/features/progress/progress-stats";
import { getProfilePointTotal } from "@/features/progress/point-sources";
import type {
  DeveloperBudgetItem,
  DeveloperDashboardStats,
  DeveloperAuditLog,
  DeveloperPointSource,
  DeveloperUserDetail,
  DeveloperUserPage,
  DeveloperUserSummary,
} from "@/features/developer/developer-types";
import type { Tier } from "@/types/domain";

type BudgetRow = {
  id: string;
  service_name: string;
  monthly_cost_try: number | string;
  service_url: string;
  notes: string;
  billing_day: number | null;
  is_active: boolean;
  updated_at: string;
};

type StatsRow = {
  total_users: number | string;
  basic_subscribers: number | string;
  pro_subscribers: number | string;
  active_cards: number | string;
  learned_cards: number | string;
  total_cards: number | string;
  monthly_recurring_revenue_try: number | string;
  revenue_priced_subscribers: number | string;
  revenue_unpriced_subscribers: number | string;
};

type ProfileRow = {
  user_id: string;
  created_at: string;
  display_name: string | null;
  preferred_language_code: string | null;
  preferred_tier: string | null;
  onboarding_completed: boolean | null;
  preferred_ui_locale: string | null;
  theme: string | null;
  profile_picture_index: number | null;
  leaderboard_visible: boolean | null;
  push_marketing_enabled: boolean | null;
  ai_practice_points: number | null;
  chest_points: number | null;
  streak_points: number | null;
  mission_points: number | null;
  quiz_result_points: number | null;
  game_points: number | null;
  gem_points: number | null;
  blue_gems: number | null;
  green_gems: number | null;
  purple_gems: number | null;
};

type SubscriptionRow = {
  user_id: string;
  plan: string;
  status: string;
  provider: string | null;
  ends_at: string | null;
  billing_cycle: string | null;
  recurring_price_amount: number | string | null;
  recurring_price_currency: string | null;
  recurring_monthly_try: number | string | null;
  auto_renew_enabled: boolean | null;
  renews_at: string | null;
  updated_at: string | null;
};

type CardRow = {
  user_id: string;
  card_source_key: string;
  status: string;
  correct_count: number | null;
  added_at: string;
  learned_at: string | null;
};
type ListAttemptRow = { user_id: string; is_correct: boolean; created_at: string };
type DetailCardRow = {
  card_source_key: string;
  status: string;
  correct_count: number | null;
  added_at: string;
  learned_at: string | null;
};
type EventSummary = { count: number; lastEarnedAt: string | null };
type AttemptActivity = {
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  firstAttemptAt: string | null;
  lastAttemptAt: string | null;
};
type AuditRow = {
  id: string;
  actor_email: string;
  action: string;
  target_user_id: string | null;
  created_at: string;
};

const SUPABASE_PAGE_SIZE = 1000;

async function readAllRows<T>(
  loadPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: unknown;
  }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < SUPABASE_PAGE_SIZE) return rows;
  }
}

async function readAuthUsersBestEffort(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
) {
  const usersById = new Map<string, User>();
  const authPageSize = 100;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: authPageSize,
    });

    for (const user of data?.users ?? []) {
      usersById.set(user.id, user);
    }

    if (error || !data?.users || data.users.length < authPageSize) break;
    if (data.total !== undefined && data.total !== null && usersById.size >= data.total) break;
  }

  return [...usersById.values()];
}

function asNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseTier(value: string | undefined): Tier | null {
  return value === "A1" || value === "A2" || value === "B1" || value === "B2" || value === "C1"
    ? value
    : null;
}

async function getEventSummary(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  userId: string,
  filter?: { column: string; value: string },
): Promise<EventSummary> {
  let countQuery = supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
  let latestQuery = supabase.from(table).select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
  if (filter) {
    countQuery = countQuery.eq(filter.column, filter.value);
    latestQuery = latestQuery.eq(filter.column, filter.value);
  }
  const [{ count, error: countError }, { data, error: latestError }] = await Promise.all([
    countQuery,
    latestQuery,
  ]);
  if (countError) throw countError;
  if (latestError) throw latestError;
  return { count: count ?? 0, lastEarnedAt: (data?.[0] as { created_at?: string } | undefined)?.created_at ?? null };
}

async function getAttemptActivity(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
): Promise<AttemptActivity> {
  const base = () => supabase.from("practice_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId);
  const [{ count: total, error: totalError }, { count: correct, error: correctError }, { count: incorrect, error: incorrectError }, { data: first, error: firstError }, { data: last, error: lastError }] = await Promise.all([
    base(),
    base().eq("is_correct", true),
    base().eq("is_correct", false),
    supabase.from("practice_attempts").select("created_at").eq("user_id", userId).order("created_at", { ascending: true }).limit(1),
    supabase.from("practice_attempts").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
  ]);
  if (totalError) throw totalError;
  if (correctError) throw correctError;
  if (incorrectError) throw incorrectError;
  if (firstError) throw firstError;
  if (lastError) throw lastError;
  return {
    totalAttempts: total ?? 0,
    correctAttempts: correct ?? 0,
    incorrectAttempts: incorrect ?? 0,
    firstAttemptAt: (first?.[0] as { created_at?: string } | undefined)?.created_at ?? null,
    lastAttemptAt: (last?.[0] as { created_at?: string } | undefined)?.created_at ?? null,
  };
}

export async function getDeveloperBudgetItems(): Promise<
  DeveloperBudgetItem[]
> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("developer_budget_items")
    .select(
      "id, service_name, monthly_cost_try, service_url, notes, billing_day, is_active, updated_at",
    )
    .order("is_active", { ascending: false })
    .order("service_name", { ascending: true })
    .returns<BudgetRow[]>();

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    serviceName: row.service_name,
    monthlyCostTry: asNumber(row.monthly_cost_try),
    serviceUrl: row.service_url,
    notes: row.notes,
    billingDay: row.billing_day,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  }));
}

export async function getDeveloperDashboardStats(): Promise<DeveloperDashboardStats> {
  const supabase = createSupabaseAdminClient();
  const [{ data, error }, { data: authData, error: authError }] =
    await Promise.all([
      supabase.rpc("developer_admin_dashboard_stats"),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
    ]);
  if (error) throw error;
  if (authError) throw authError;

  const row = (data as StatsRow[] | null)?.[0];
  const basicSubscribers = asNumber(row?.basic_subscribers);
  const proSubscribers = asNumber(row?.pro_subscribers);

  const totalUsers = authData.total ?? asNumber(row?.total_users);
  return {
    totalUsers,
    freeSubscribers: Math.max(
      0,
      totalUsers - basicSubscribers - proSubscribers,
    ),
    basicSubscribers,
    proSubscribers,
    activeCards: asNumber(row?.active_cards),
    learnedCards: asNumber(row?.learned_cards),
    totalCards: asNumber(row?.total_cards),
    monthlyRevenueTry: asNumber(row?.monthly_recurring_revenue_try),
    revenuePricedSubscribers: asNumber(row?.revenue_priced_subscribers),
    revenueUnpricedSubscribers: asNumber(row?.revenue_unpriced_subscribers),
  };
}

export async function getDeveloperUsers(
  input: { page?: number; perPage?: number } = {},
): Promise<DeveloperUserPage> {
  void input;
  const supabase = createSupabaseAdminClient();

  const [profiles, subscriptions, cards, attempts, customCards] = await Promise.all([
    readAllRows((from, to) =>
      supabase
        .from("user_profiles")
        .select(
          "user_id, created_at, display_name, preferred_language_code, preferred_tier, onboarding_completed, preferred_ui_locale, theme, profile_picture_index, leaderboard_visible, push_marketing_enabled, ai_practice_points, chest_points, streak_points, mission_points, quiz_result_points, game_points, gem_points, blue_gems, green_gems, purple_gems",
        )
        .range(from, to)
        .returns<ProfileRow[]>(),
    ),
    readAllRows((from, to) =>
      supabase
        .from("user_subscriptions")
        .select("user_id, plan, status, provider, ends_at, billing_cycle, recurring_price_amount, recurring_price_currency, recurring_monthly_try, auto_renew_enabled, renews_at, updated_at")
        .range(from, to)
        .returns<SubscriptionRow[]>(),
    ),
    readAllRows((from, to) =>
      supabase
        .from("user_cards")
        .select("user_id, card_source_key, status, correct_count, added_at, learned_at")
        .range(from, to)
        .returns<CardRow[]>(),
    ),
    readAllRows((from, to) =>
      supabase
        .from("practice_attempts")
        .select("user_id, is_correct, created_at")
        .range(from, to)
        .returns<ListAttemptRow[]>(),
    ),
    readAllRows((from, to) =>
      supabase
        .from("custom_cards")
        .select("user_id, source_key, tier")
        .range(from, to)
        .returns<Array<{ user_id: string; source_key: string; tier: string }>>(),
      ),
  ]);

  const authUsers = await readAuthUsersBestEffort(supabase);
  if (authUsers.length === 0 && profiles.length === 0) {
    return { users: [], page: 1, perPage: 40, total: 0 };
  }

  const profileByUserId = new Map(
    profiles.map((row) => [row.user_id, row]),
  );
  const subscriptionByUserId = new Map(
    subscriptions.map((row) => [row.user_id, row]),
  );
  const customTierBySourceKey = new Map(
    customCards.map((row) => [row.source_key, parseTier(row.tier)]),
  );
  const cardTierBySourceKey = new Map(
    VOCABULARY_CARDS.map((card) => [card.sourceKey, card.tier]),
  );
  const cardMetrics = new Map<string, { active: number; learned: number; totalCorrect: number; learnedPoints: number; firstAddedAt: string | null; lastProgressAt: string | null }>();
  for (const card of cards) {
    const current = cardMetrics.get(card.user_id) ?? { active: 0, learned: 0, totalCorrect: 0, learnedPoints: 0, firstAddedAt: null, lastProgressAt: null };
    if (card.status === "learned") {
      current.learned += 1;
      const tier = parseTier(cardTierBySourceKey.get(card.card_source_key)) ?? customTierBySourceKey.get(card.card_source_key);
      if (tier) current.learnedPoints += TIER_POINTS[tier];
    }
    else current.active += 1;
    current.totalCorrect += card.correct_count ?? 0;
    current.firstAddedAt = !current.firstAddedAt || card.added_at < current.firstAddedAt ? card.added_at : current.firstAddedAt;
    const progressAt = card.learned_at ?? card.added_at;
    current.lastProgressAt = !current.lastProgressAt || progressAt > current.lastProgressAt ? progressAt : current.lastProgressAt;
    cardMetrics.set(card.user_id, current);
  }
  const attemptMetrics = new Map<string, { total: number; correct: number; firstAttemptAt: string | null; lastAttemptAt: string | null }>();
  for (const attempt of attempts) {
    const current = attemptMetrics.get(attempt.user_id) ?? { total: 0, correct: 0, firstAttemptAt: null, lastAttemptAt: null };
    current.total += 1;
    if (attempt.is_correct) current.correct += 1;
    current.firstAttemptAt = !current.firstAttemptAt || attempt.created_at < current.firstAttemptAt ? attempt.created_at : current.firstAttemptAt;
    current.lastAttemptAt = !current.lastAttemptAt || attempt.created_at > current.lastAttemptAt ? attempt.created_at : current.lastAttemptAt;
    attemptMetrics.set(attempt.user_id, current);
  }

  const userIds = new Set([
    ...authUsers.map((user) => user.id),
    ...profiles.map((profile) => profile.user_id),
  ]);
  const users: DeveloperUserSummary[] = [...userIds].map((userId) => {
    const user = authUsers.find((authUser) => authUser.id === userId);
    const profile = profileByUserId.get(userId);
    const subscription = subscriptionByUserId.get(userId);
    const counts = cardMetrics.get(userId) ?? { active: 0, learned: 0, totalCorrect: 0, learnedPoints: 0, firstAddedAt: null, lastProgressAt: null };
    const attempts = attemptMetrics.get(userId) ?? { total: 0, correct: 0, firstAttemptAt: null, lastAttemptAt: null };
    const profilePoints = {
      aiPracticePoints: profile?.ai_practice_points ?? 0,
      chestPoints: profile?.chest_points ?? 0,
      streakPoints: profile?.streak_points ?? 0,
      missionPoints: profile?.mission_points ?? 0,
      quizResultPoints: profile?.quiz_result_points ?? 0,
      gamePoints: profile?.game_points ?? 0,
      gemPoints: profile?.gem_points ?? 0,
    };
    const plan =
      subscription?.plan === "basic" || subscription?.plan === "pro"
        ? subscription.plan
        : "free";
    return {
      id: userId,
      email: user?.email ?? "No email",
      displayName: profile?.display_name ?? null,
      preferredLanguage: profile?.preferred_language_code ?? null,
      preferredTier: profile?.preferred_tier ?? null,
      onboardingCompleted: profile?.onboarding_completed ?? false,
      createdAt: user?.created_at ?? profile?.created_at ?? new Date(0).toISOString(),
      lastSignInAt: user?.last_sign_in_at ?? null,
      emailConfirmedAt: user?.email_confirmed_at ?? null,
      phoneConfirmedAt: user?.phone_confirmed_at ?? null,
      providers: [...new Set((user?.identities ?? []).map((identity) => identity.provider))],
      preferredUiLocale: profile?.preferred_ui_locale ?? null,
      theme: profile?.theme ?? null,
      profilePictureIndex: profile?.profile_picture_index ?? null,
      leaderboardVisible: profile?.leaderboard_visible ?? false,
      pushMarketingEnabled: profile?.push_marketing_enabled ?? false,
      plan,
      status: subscription?.status ?? "free",
      provider:
        subscription?.provider === "google_play" ||
        subscription?.provider === "admin"
          ? subscription.provider
          : null,
      endsAt: subscription?.ends_at ?? null,
      activeCards: counts.active,
      learnedCards: counts.learned,
      totalCards: counts.active + counts.learned,
      totalCorrectAnswers: counts.totalCorrect,
      totalAttempts: attempts.total,
      totalPoints: counts.learnedPoints + getProfilePointTotal(profilePoints),
      ...profilePoints,
      blueGems: profile?.blue_gems ?? 0,
      greenGems: profile?.green_gems ?? 0,
      purpleGems: profile?.purple_gems ?? 0,
      billingCycle: subscription?.billing_cycle ?? null,
      recurringPriceAmount: subscription?.recurring_price_amount == null ? null : asNumber(subscription.recurring_price_amount),
      recurringPriceCurrency: subscription?.recurring_price_currency ?? null,
      subscriptionUpdatedAt: subscription?.updated_at ?? null,
      recurringMonthlyTry: subscription?.recurring_monthly_try == null ? null : asNumber(subscription.recurring_monthly_try),
      autoRenewEnabled: subscription?.auto_renew_enabled ?? false,
      renewsAt: subscription?.renews_at ?? null,
      firstCardAddedAt: counts.firstAddedAt,
      lastCardProgressAt: counts.lastProgressAt,
      firstAttemptAt: attempts.firstAttemptAt,
      lastAttemptAt: attempts.lastAttemptAt,
    };
  });

  return { users, page: 1, perPage: 40, total: users.length };
}

export async function getDeveloperUserDetail(
  userId: string,
): Promise<DeveloperUserDetail | null> {
  const supabase = createSupabaseAdminClient();
  const [{ data: authResult, error: authError }, profileResult, subscriptionResult, cardsResult, customCardsResult] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase
      .from("user_profiles")
      .select("user_id, created_at, display_name, preferred_language_code, preferred_tier, onboarding_completed, preferred_ui_locale, theme, profile_picture_index, leaderboard_visible, push_marketing_enabled, ai_practice_points, chest_points, streak_points, mission_points, quiz_result_points, game_points, gem_points, blue_gems, green_gems, purple_gems")
      .eq("user_id", userId)
      .maybeSingle<ProfileRow>(),
    supabase
      .from("user_subscriptions")
      .select("user_id, plan, status, provider, ends_at, billing_cycle, recurring_price_amount, recurring_price_currency, recurring_monthly_try, auto_renew_enabled, renews_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle<SubscriptionRow>(),
    readAllRows((from, to) =>
      supabase
        .from("user_cards")
        .select("card_source_key, status, correct_count, added_at, learned_at")
        .eq("user_id", userId)
        .order("added_at", { ascending: true })
        .range(from, to)
        .returns<DetailCardRow[]>(),
    ),
    readAllRows((from, to) =>
      supabase
        .from("custom_cards")
        .select("source_key, tier")
        .eq("user_id", userId)
        .range(from, to)
        .returns<Array<{ source_key: string; tier: string }>>(),
    ),
  ]);

  if (authError && !profileResult.data) throw authError;
  if (profileResult.error) throw profileResult.error;
  if (subscriptionResult.error) throw subscriptionResult.error;

  const authUser = authResult.user;
  if (!authUser && !profileResult.data) return null;

  const profile = profileResult.data;
  const subscription = subscriptionResult.data;
  const cards = cardsResult;
  const customTierBySourceKey = new Map(
    customCardsResult.map((card) => [card.source_key, card.tier]),
  );
  const cardTierBySourceKey = new Map(
    VOCABULARY_CARDS.map((card) => [card.sourceKey, card.tier]),
  );
  const tierStats = new Map<string, { total: number; learned: number; points: number }>();
  let totalCorrect = 0;
  let learnedCardPoints = 0;

  for (const card of cards) {
    const tier =
      parseTier(cardTierBySourceKey.get(card.card_source_key)) ??
      parseTier(customTierBySourceKey.get(card.card_source_key)) ??
      "Diğer";
    const stats = tierStats.get(tier) ?? { total: 0, learned: 0, points: 0 };
    stats.total += 1;
    totalCorrect += card.correct_count ?? 0;
    if (card.status === "learned") {
      stats.learned += 1;
      if (tier !== "Diğer") {
        const points = TIER_POINTS[tier];
        stats.points += points;
        learnedCardPoints += points;
      }
    }
    tierStats.set(tier, stats);
  }

  const orderedTiers = ["A1", "A2", "B1", "B2", "C1"];
  const byTier = [
    ...orderedTiers,
    ...(tierStats.has("Diğer") ? ["Diğer"] : []),
  ].map((tier) => ({ tier, ...(tierStats.get(tier) ?? { total: 0, learned: 0, points: 0 }) }));

  const profilePoints = {
    aiPracticePoints: profile?.ai_practice_points ?? 0,
    chestPoints: profile?.chest_points ?? 0,
    streakPoints: profile?.streak_points ?? 0,
    missionPoints: profile?.mission_points ?? 0,
    quizResultPoints: profile?.quiz_result_points ?? 0,
    gamePoints: profile?.game_points ?? 0,
    gemPoints: profile?.gem_points ?? 0,
  };
  const [pointEventResults, activity] = await Promise.all([
    Promise.all([
      getEventSummary(supabase, "ai_practice_scores", userId),
      getEventSummary(supabase, "chest_rewards", userId),
      getEventSummary(supabase, "quiz_streak_rewards", userId),
      getEventSummary(supabase, "mission_rewards", userId, { column: "reward_type", value: "points" }),
      getEventSummary(supabase, "quiz_result_rewards", userId),
    ]),
    getAttemptActivity(supabase, userId),
  ]);
  const pointSourceDefinitions: Array<{
    key: DeveloperPointSource["key"];
    label: string;
    points: number;
    event: EventSummary | null;
  }> = [
    { key: "learned_cards", label: "Öğrenilmiş kartlar", points: learnedCardPoints, event: null },
    { key: "ai_practice", label: "AI Practice", points: profilePoints.aiPracticePoints, event: pointEventResults[0] },
    { key: "chests", label: "Sandık ödülleri", points: profilePoints.chestPoints, event: pointEventResults[1] },
    { key: "quiz_streaks", label: "Quiz serileri", points: profilePoints.streakPoints, event: pointEventResults[2] },
    { key: "missions", label: "Misyonlar", points: profilePoints.missionPoints, event: pointEventResults[3] },
    { key: "quiz_results", label: "Quiz sonuçları", points: profilePoints.quizResultPoints, event: pointEventResults[4] },
    { key: "games", label: "Oyunlar", points: profilePoints.gamePoints, event: null },
    { key: "gem_conversion", label: "Gem dönüşümleri", points: profilePoints.gemPoints, event: null },
  ];
  const pointSources = pointSourceDefinitions.map(({ key, label, points, event }) => ({
    key,
    label,
    points,
    eventCount: event?.count ?? null,
    lastEarnedAt: event?.lastEarnedAt ?? null,
  }));
  const totalPoints = learnedCardPoints + getProfilePointTotal(profilePoints);
  const firstCardAddedAt = cards[0]?.added_at ?? null;
  const lastCardProgressAt = cards.reduce<string | null>((latest, card) => {
    const candidate = card.learned_at ?? card.added_at;
    return !latest || candidate > latest ? candidate : latest;
  }, null);
  const summary: DeveloperUserSummary = {
    id: userId,
    email: authUser?.email ?? "No email",
    displayName: profile?.display_name ?? null,
    preferredLanguage: profile?.preferred_language_code ?? null,
    preferredTier: profile?.preferred_tier ?? null,
    onboardingCompleted: profile?.onboarding_completed ?? false,
    createdAt: authUser?.created_at ?? profile?.created_at ?? new Date(0).toISOString(),
    lastSignInAt: authUser?.last_sign_in_at ?? null,
    emailConfirmedAt: authUser?.email_confirmed_at ?? null,
    phoneConfirmedAt: authUser?.phone_confirmed_at ?? null,
    providers: [...new Set((authUser?.identities ?? []).map((identity) => identity.provider))],
    preferredUiLocale: profile?.preferred_ui_locale ?? null,
    theme: profile?.theme ?? null,
    profilePictureIndex: profile?.profile_picture_index ?? null,
    leaderboardVisible: profile?.leaderboard_visible ?? false,
    pushMarketingEnabled: profile?.push_marketing_enabled ?? false,
    plan: subscription?.plan === "basic" || subscription?.plan === "pro" ? subscription.plan : "free",
    status: subscription?.status ?? "free",
    provider: subscription?.provider === "google_play" || subscription?.provider === "admin" ? subscription.provider : null,
    endsAt: subscription?.ends_at ?? null,
    activeCards: cards.filter((card) => card.status !== "learned").length,
    learnedCards: cards.filter((card) => card.status === "learned").length,
    totalCards: cards.length,
    totalCorrectAnswers: totalCorrect,
    totalAttempts: activity.totalAttempts,
    totalPoints,
    ...profilePoints,
    blueGems: profile?.blue_gems ?? 0,
    greenGems: profile?.green_gems ?? 0,
    purpleGems: profile?.purple_gems ?? 0,
    billingCycle: subscription?.billing_cycle ?? null,
    recurringPriceAmount: subscription?.recurring_price_amount == null ? null : asNumber(subscription.recurring_price_amount),
    recurringPriceCurrency: subscription?.recurring_price_currency ?? null,
    subscriptionUpdatedAt: subscription?.updated_at ?? null,
    recurringMonthlyTry: subscription?.recurring_monthly_try == null ? null : asNumber(subscription.recurring_monthly_try),
    autoRenewEnabled: subscription?.auto_renew_enabled ?? false,
    renewsAt: subscription?.renews_at ?? null,
    firstCardAddedAt,
    lastCardProgressAt,
    firstAttemptAt: activity.firstAttemptAt,
    lastAttemptAt: activity.lastAttemptAt,
  };

  return {
    ...summary,
    auth: {
      emailConfirmedAt: authUser?.email_confirmed_at ?? null,
      phoneConfirmedAt: authUser?.phone_confirmed_at ?? null,
      providers: [...new Set((authUser?.identities ?? []).map((identity) => identity.provider))],
    },
    profile: {
      preferredUiLocale: profile?.preferred_ui_locale ?? null,
      theme: profile?.theme ?? null,
      profilePictureIndex: profile?.profile_picture_index ?? null,
      leaderboardVisible: profile?.leaderboard_visible ?? false,
      pushMarketingEnabled: profile?.push_marketing_enabled ?? false,
      blueGems: profile?.blue_gems ?? 0,
      greenGems: profile?.green_gems ?? 0,
      purpleGems: profile?.purple_gems ?? 0,
    },
    subscription: subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
          provider: subscription.provider,
          billingCycle: subscription.billing_cycle,
          recurringPriceAmount: subscription.recurring_price_amount === null ? null : asNumber(subscription.recurring_price_amount),
          recurringPriceCurrency: subscription.recurring_price_currency,
          recurringMonthlyTry: subscription.recurring_monthly_try === null ? null : asNumber(subscription.recurring_monthly_try),
          autoRenewEnabled: subscription.auto_renew_enabled ?? false,
          renewsAt: subscription.renews_at,
          endsAt: subscription.ends_at,
          updatedAt: subscription.updated_at,
        }
      : null,
    cards: {
      total: cards.length,
      active: summary.activeCards,
      learned: summary.learnedCards,
      totalCorrect,
      firstAddedAt: cards[0]?.added_at ?? null,
      lastProgressAt: cards.reduce<string | null>((latest, card) => {
        const candidate = card.learned_at ?? card.added_at;
        return !latest || candidate > latest ? candidate : latest;
      }, null),
      byTier,
    },
    activity,
    pointSources,
    totalPoints,
    rank: getRankForPoints(totalPoints),
  };
}

export async function getDeveloperAuditLogs(
  limit = 20,
): Promise<DeveloperAuditLog[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("developer_admin_audit_logs")
    .select("id, actor_email, action, target_user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)))
    .returns<AuditRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    actorEmail: row.actor_email,
    action: row.action,
    targetUserId: row.target_user_id,
    createdAt: row.created_at,
  }));
}

export async function writeDeveloperAuditLog(input: {
  actor: { id: string; email: string };
  action: string;
  targetUserId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("developer_admin_audit_logs").insert({
    actor_user_id: input.actor.id,
    actor_email: input.actor.email,
    action: input.action,
    target_user_id: input.targetUserId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
}
