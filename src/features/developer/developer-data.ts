import "server-only";

import type { User } from "@supabase/supabase-js";
import { VOCABULARY_CARDS } from "@/data/cards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getRankForPoints,
  TIER_POINTS,
} from "@/features/progress/progress-stats";
import { getProfilePointTotal } from "@/features/progress/point-sources";
import type {
  DeveloperBudgetItem,
  DeveloperDashboardStats,
  DeveloperAnalyticsData,
  DeveloperAnalyticsDistributionItem,
  DeveloperAnalyticsSeriesPoint,
  DeveloperAuditLog,
  DeveloperContactReview,
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
type ListAttemptRow = {
  user_id: string;
  is_correct: boolean;
  created_at: string;
};
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

type ReviewRow = {
  id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
};

type ReviewProfileRow = {
  user_id: string;
  display_name: string | null;
  profile_picture_index: number | null;
  preferred_language_code: string | null;
  preferred_ui_locale: string | null;
};

type AnalyticsAttemptRow = {
  user_id: string;
  card_source_key: string;
  is_correct: boolean;
  created_at: string;
};

type AnalyticsCustomCardRow = {
  user_id: string;
  source_key: string;
  language: string;
  created_at: string;
};

type AnalyticsAiUsageRow = {
  user_id: string;
  event_type: string;
  created_at: string;
};

type AnalyticsRtdnRow = {
  user_id: string | null;
  payload: unknown;
  created_at: string;
};

type AnalyticsLoginEventRow = {
  user_id: string;
  created_at: string;
};

const SUPABASE_PAGE_SIZE = 1000;

async function readAllRows<T>(
  loadPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
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

async function readAllRowsBestEffort<T>(
  loadPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: unknown;
  }>,
) {
  try {
    return await readAllRows(loadPage);
  } catch {
    return [] as T[];
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
    if (
      data.total !== undefined &&
      data.total !== null &&
      usersById.size >= data.total
    )
      break;
  }

  return [...usersById.values()];
}

async function readAuthUsersByIdBestEffort(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userIds: string[],
) {
  const usersById = new Map<string, User>();
  const uniqueUserIds = [...new Set(userIds)];

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const { data, error } = await supabase.auth.admin.getUserById(userId);

      if (error) {
        console.warn("[developer] Auth kullanıcısı e-postası alınamadı.", {
          userId,
          message: error.message,
        });
        return;
      }

      if (data.user) {
        usersById.set(data.user.id, data.user);
      }
    }),
  );

  return [...usersById.values()];
}

function asNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseTier(value: string | undefined): Tier | null {
  return value === "A1" ||
    value === "A2" ||
    value === "B1" ||
    value === "B2" ||
    value === "C1"
    ? value
    : null;
}

async function getEventSummary(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  userId: string,
  filter?: { column: string; value: string },
): Promise<EventSummary> {
  let countQuery = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  let latestQuery = supabase
    .from(table)
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (filter) {
    countQuery = countQuery.eq(filter.column, filter.value);
    latestQuery = latestQuery.eq(filter.column, filter.value);
  }
  const [{ count, error: countError }, { data, error: latestError }] =
    await Promise.all([countQuery, latestQuery]);
  if (countError) throw countError;
  if (latestError) throw latestError;
  return {
    count: count ?? 0,
    lastEarnedAt:
      (data?.[0] as { created_at?: string } | undefined)?.created_at ?? null,
  };
}

async function getAttemptActivity(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
): Promise<AttemptActivity> {
  const base = () =>
    supabase
      .from("practice_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
  const [
    { count: total, error: totalError },
    { count: correct, error: correctError },
    { count: incorrect, error: incorrectError },
    { data: first, error: firstError },
    { data: last, error: lastError },
  ] = await Promise.all([
    base(),
    base().eq("is_correct", true),
    base().eq("is_correct", false),
    supabase
      .from("practice_attempts")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("practice_attempts")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1),
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
    firstAttemptAt:
      (first?.[0] as { created_at?: string } | undefined)?.created_at ?? null,
    lastAttemptAt:
      (last?.[0] as { created_at?: string } | undefined)?.created_at ?? null,
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

type AnalyticsPeriod = "daily" | "weekly" | "monthly";

const analyticsDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});
const analyticsMonthFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

function analyticsPeriodStart(value: string | Date, period: AnalyticsPeriod) {
  const date = new Date(value);
  if (period === "monthly")
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  if (period === "weekly") {
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() - mondayOffset,
      ),
    );
  }
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function analyticsPeriodKey(value: string | Date, period: AnalyticsPeriod) {
  return analyticsPeriodStart(value, period).toISOString().slice(0, 10);
}

function shiftAnalyticsPeriod(
  value: Date,
  period: AnalyticsPeriod,
  amount: number,
) {
  if (period === "monthly")
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + amount, 1),
    );
  const days = period === "weekly" ? 7 : 1;
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate() + amount * days,
    ),
  );
}

function analyticsPeriodLabel(value: Date, period: AnalyticsPeriod) {
  if (period === "monthly") return analyticsMonthFormatter.format(value);
  return analyticsDateFormatter.format(value);
}

function buildAnalyticsSeries(
  primaryDates: string[],
  period: AnalyticsPeriod,
  count: number,
  secondaryDates: string[] = [],
): DeveloperAnalyticsSeriesPoint[] {
  const now = new Date();
  const latestStart = analyticsPeriodStart(now, period);
  const buckets = new Map<string, { value: number; secondaryValue: number }>();
  for (let index = count - 1; index >= 0; index -= 1) {
    const start = shiftAnalyticsPeriod(latestStart, period, -index);
    buckets.set(start.toISOString().slice(0, 10), {
      value: 0,
      secondaryValue: 0,
    });
  }

  for (const date of primaryDates) {
    const key = analyticsPeriodKey(date, period);
    const bucket = buckets.get(key);
    if (bucket) bucket.value += 1;
  }
  for (const date of secondaryDates) {
    const key = analyticsPeriodKey(date, period);
    const bucket = buckets.get(key);
    if (bucket) bucket.secondaryValue += 1;
  }

  return [...buckets.entries()].map(([key, bucket]) => ({
    key,
    label: analyticsPeriodLabel(new Date(`${key}T00:00:00.000Z`), period),
    value: bucket.value,
    ...(secondaryDates.length > 0
      ? { secondaryValue: bucket.secondaryValue }
      : {}),
  }));
}

function buildUniqueUserSeries(
  events: Array<{ user_id: string; created_at: string }>,
  period: AnalyticsPeriod,
  count: number,
): DeveloperAnalyticsSeriesPoint[] {
  const now = new Date();
  const latestStart = analyticsPeriodStart(now, period);
  const buckets = new Map<string, Set<string>>();
  for (let index = count - 1; index >= 0; index -= 1) {
    const start = shiftAnalyticsPeriod(latestStart, period, -index);
    buckets.set(start.toISOString().slice(0, 10), new Set<string>());
  }

  for (const event of events) {
    const bucket = buckets.get(analyticsPeriodKey(event.created_at, period));
    if (bucket) bucket.add(event.user_id);
  }

  return [...buckets.entries()].map(([key, users]) => ({
    key,
    label: analyticsPeriodLabel(new Date(`${key}T00:00:00.000Z`), period),
    value: users.size,
  }));
}

function buildAnalyticsDistribution(
  values: Array<string | null | undefined>,
  labelFor: (value: string) => string = (value) => value,
): DeveloperAnalyticsDistributionItem[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value?.trim() || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = values.length;
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([key, value]) => ({
      key,
      label: labelFor(key),
      value,
      percent: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
    }));
}

function maskAnalyticsEmail(email: string | undefined) {
  if (!email) return null;
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "•••";
  return `${localPart.slice(0, 1)}•••@${domain}`;
}

function readRtdnNotificationType(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const notification = (payload as { subscriptionNotification?: unknown })
    .subscriptionNotification;
  if (!notification || typeof notification !== "object") return null;
  const value = (notification as { notificationType?: unknown })
    .notificationType;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isAnalyticsActiveSubscription(
  row: SubscriptionRow,
): row is SubscriptionRow & { plan: "basic" | "pro"; ends_at: string } {
  if (
    !["google_play", "admin"].includes(row.provider ?? "") ||
    !["basic", "pro"].includes(row.plan)
  ) {
    return false;
  }

  const endsAt = row.ends_at ? new Date(row.ends_at).getTime() : Number.NaN;
  if (!Number.isFinite(endsAt) || endsAt <= Date.now()) return false;

  return ["active", "on_trial", "past_due", "cancelled"].includes(row.status);
}

const analyticsLanguageLabels: Record<string, string> = {
  tr: "Türkçe",
  en: "İngilizce",
  de: "Almanca",
  ru: "Rusça",
  fr: "Fransızca",
  es: "İspanyolca",
  it: "İtalyanca",
  pt: "Portekizce",
  nl: "Felemenkçe",
  pl: "Lehçe",
  ar: "Arapça",
  ja: "Japonca",
  ko: "Korece",
  "zh-CN": "Çince",
  unknown: "Belirtilmemiş",
};

function analyticsLanguageLabel(value: string) {
  return analyticsLanguageLabels[value] ?? value;
}

export async function getDeveloperAnalytics(): Promise<DeveloperAnalyticsData> {
  const supabase = createSupabaseAdminClient();
  const loginWindowStart = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const [
    authUsers,
    profiles,
    subscriptions,
    cards,
    attempts,
    reviews,
    customCards,
    aiUsage,
    rtdnEvents,
    loginEvents,
  ] = await Promise.all([
    readAuthUsersBestEffort(supabase),
    readAllRows((from, to) =>
      supabase
        .from("user_profiles")
        .select(
          "user_id, created_at, display_name, preferred_language_code, preferred_ui_locale, onboarding_completed",
        )
        .range(from, to)
        .returns<
          Array<
            Pick<
              ProfileRow,
              | "user_id"
              | "created_at"
              | "display_name"
              | "preferred_language_code"
              | "preferred_ui_locale"
              | "onboarding_completed"
            >
          >
        >(),
    ),
    readAllRows((from, to) =>
      supabase
        .from("user_subscriptions")
        .select(
          "user_id, plan, status, provider, ends_at, billing_cycle, recurring_price_amount, recurring_price_currency, recurring_monthly_try, auto_renew_enabled, renews_at, updated_at",
        )
        .range(from, to)
        .returns<SubscriptionRow[]>(),
    ),
    readAllRows((from, to) =>
      supabase
        .from("user_cards")
        .select(
          "user_id, card_source_key, status, correct_count, added_at, learned_at",
        )
        .range(from, to)
        .returns<CardRow[]>(),
    ),
    readAllRows((from, to) =>
      supabase
        .from("practice_attempts")
        .select("user_id, card_source_key, is_correct, created_at")
        .range(from, to)
        .returns<AnalyticsAttemptRow[]>(),
    ),
    readAllRows((from, to) =>
      supabase
        .from("reviews")
        .select("id, user_id, rating, comment, created_at, updated_at")
        .range(from, to)
        .returns<ReviewRow[]>(),
    ),
    readAllRows((from, to) =>
      supabase
        .from("custom_cards")
        .select("user_id, source_key, language, created_at")
        .range(from, to)
        .returns<AnalyticsCustomCardRow[]>(),
    ),
    readAllRows((from, to) =>
      supabase
        .from("ai_usage_events")
        .select("user_id, event_type, created_at")
        .range(from, to)
        .returns<AnalyticsAiUsageRow[]>(),
    ),
    readAllRowsBestEffort((from, to) =>
      supabase
        .from("google_play_rtdn_events")
        .select("user_id, payload, created_at")
        .range(from, to)
        .returns<AnalyticsRtdnRow[]>(),
    ),
    readAllRowsBestEffort((from, to) =>
      supabase
        .from("app_login_events")
        .select("user_id, created_at")
        .gte("created_at", loginWindowStart)
        .order("created_at", { ascending: true })
        .range(from, to)
        .returns<AnalyticsLoginEventRow[]>(),
    ),
  ]);

  const totalUsers = authUsers.length;
  const profilesByUserId = new Map(
    profiles.map((profile) => [profile.user_id, profile]),
  );
  const subscriptionsByUserId = new Map(
    subscriptions.map((subscription) => [subscription.user_id, subscription]),
  );
  const customLanguageBySourceKey = new Map(
    customCards.map((card) => [card.source_key, card.language]),
  );
  const catalogLanguageBySourceKey = new Map(
    VOCABULARY_CARDS.map((card) => [card.sourceKey, card.language]),
  );
  const users =
    authUsers.length > 0
      ? authUsers
      : profiles.map(
          (profile) =>
            ({ id: profile.user_id, created_at: profile.created_at }) as User,
        );

  const displayNameFor = (userId: string) =>
    profilesByUserId.get(userId)?.display_name ?? null;
  const emailFor = (userId: string) =>
    maskAnalyticsEmail(authUsers.find((user) => user.id === userId)?.email);
  const userCreatedDates = users.map((user) => user.created_at).filter(Boolean);
  const learnedCardDates = cards
    .map((card) => card.learned_at)
    .filter((date): date is string => Boolean(date));
  const addedCardDates = cards.map((card) => card.added_at).filter(Boolean);
  const attemptDates = attempts
    .map((attempt) => attempt.created_at)
    .filter(Boolean);
  const reviewDates = reviews
    .map((review) => review.created_at)
    .filter(Boolean);
  const customCardDates = customCards
    .map((card) => card.created_at)
    .filter(Boolean);
  const appLoginDates = (
    loginEvents.length > 0
      ? loginEvents.map((event) => event.created_at)
      : authUsers
          .map((user) => user.last_sign_in_at)
          .filter((date): date is string => Boolean(date))
  ).filter(Boolean);
  const retentionActivityEvents: Array<{
    user_id: string;
    created_at: string;
  }> =
    loginEvents.length > 0
      ? loginEvents
      : authUsers
          .filter((user) => Boolean(user.last_sign_in_at))
          .map((user) => ({
            user_id: user.id,
            created_at: user.last_sign_in_at as string,
          }));
  const retentionActivityByUserId = new Map<string, string[]>();
  for (const event of retentionActivityEvents) {
    const dates = retentionActivityByUserId.get(event.user_id) ?? [];
    dates.push(event.created_at);
    retentionActivityByUserId.set(event.user_id, dates);
  }
  const retentionMilestones = [
    { key: "day1", days: 1, label: "D+1" },
    { key: "day7", days: 7, label: "D+7" },
    { key: "day14", days: 14, label: "D+14" },
    { key: "day30", days: 30, label: "D+30" },
  ] as const;
  const utcDayTimestamp = (value: string | Date) =>
    analyticsPeriodStart(value, "daily").getTime();
  const todayTimestamp = utcDayTimestamp(new Date());
  const retentionUsers = users.map((user) => {
    const signupTimestamp = utcDayTimestamp(user.created_at);
    const activityDayKeys = new Set(
      (retentionActivityByUserId.get(user.id) ?? []).map((date) =>
        analyticsPeriodKey(date, "daily"),
      ),
    );
    const retainedAt = (days: number) => {
      const target = new Date(signupTimestamp + days * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      return activityDayKeys.has(target);
    };
    return {
      user,
      signupTimestamp,
      retainedAt: {
        day1: retainedAt(1),
        day7: retainedAt(7),
        day14: retainedAt(14),
        day30: retainedAt(30),
      },
    };
  });
  const retentionMetrics = retentionMilestones.map((milestone) => {
    const eligibleUsers = retentionUsers.filter(
      (entry) =>
        todayTimestamp - entry.signupTimestamp >=
        milestone.days * 24 * 60 * 60 * 1000,
    );
    const retainedUsers = eligibleUsers.filter(
      (entry) => entry.retainedAt[milestone.key],
    ).length;
    return {
      key: milestone.key,
      label: milestone.label,
      value:
        eligibleUsers.length > 0
          ? Math.round((retainedUsers / eligibleUsers.length) * 1000) / 10
          : 0,
      retainedUsers,
      eligibleUsers: eligibleUsers.length,
    };
  });
  const retentionCohortsByKey = new Map<
    string,
    { key: string; label: string; entries: typeof retentionUsers }
  >();
  for (const entry of retentionUsers) {
    const cohortStart = analyticsPeriodStart(entry.user.created_at, "weekly");
    const key = cohortStart.toISOString().slice(0, 10);
    const cohort = retentionCohortsByKey.get(key) ?? {
      key,
      label: analyticsPeriodLabel(cohortStart, "weekly"),
      entries: [],
    };
    cohort.entries.push(entry);
    retentionCohortsByKey.set(key, cohort);
  }
  const retentionCohorts = [...retentionCohortsByKey.values()]
    .sort((left, right) => left.key.localeCompare(right.key))
    .slice(-10)
    .map((cohort) => {
      const rateFor = (
        key: (typeof retentionMilestones)[number]["key"],
        days: number,
      ) => {
        const eligible = cohort.entries.filter(
          (entry) =>
            todayTimestamp - entry.signupTimestamp >=
            days * 24 * 60 * 60 * 1000,
        );
        if (eligible.length === 0) return null;
        return (
          Math.round(
            (eligible.filter((entry) => entry.retainedAt[key]).length /
              eligible.length) *
              1000,
          ) / 10
        );
      };
      return {
        key: cohort.key,
        label: cohort.label,
        cohortSize: cohort.entries.length,
        day1: rateFor("day1", 1),
        day7: rateFor("day7", 7),
        day14: rateFor("day14", 14),
        day30: rateFor("day30", 30),
      };
    });
  const activeUsersInWindow = (days: number) =>
    new Set(
      retentionActivityEvents
        .filter(
          (event) =>
            Date.now() - new Date(event.created_at).getTime() <=
            days * 24 * 60 * 60 * 1000,
        )
        .map((event) => event.user_id),
    ).size;
  const returningUsers30d = new Set(
    retentionActivityEvents
      .filter(
        (event) =>
          Date.now() - new Date(event.created_at).getTime() <=
          30 * 24 * 60 * 60 * 1000,
      )
      .filter((event) => {
        const signupTimestamp = retentionUsers.find(
          (entry) => entry.user.id === event.user_id,
        )?.signupTimestamp;
        return (
          signupTimestamp !== undefined &&
          new Date(event.created_at).getTime() - signupTimestamp >=
            24 * 60 * 60 * 1000
        );
      })
      .map((event) => event.user_id),
  ).size;

  const recentLogins = authUsers
    .filter((user) => Boolean(user.last_sign_in_at))
    .sort(
      (left, right) =>
        new Date(right.last_sign_in_at ?? 0).getTime() -
        new Date(left.last_sign_in_at ?? 0).getTime(),
    )
    .slice(0, 10)
    .map((user) => {
      const providers = Array.isArray(user.app_metadata?.providers)
        ? user.app_metadata.providers
        : [];
      const provider = String(
        providers[0] ?? user.identities?.[0]?.provider ?? "email",
      );
      return {
        id: user.id,
        displayName: displayNameFor(user.id),
        email: maskAnalyticsEmail(user.email),
        provider,
        lastSignInAt: user.last_sign_in_at as string,
      };
    });

  const profileLanguageValues = users.map(
    (user) => profilesByUserId.get(user.id)?.preferred_language_code,
  );
  const profileUiValues = users.map(
    (user) => profilesByUserId.get(user.id)?.preferred_ui_locale,
  );

  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter(
    (attempt) => attempt.is_correct,
  ).length;
  const usersWithQuiz = new Set(attempts.map((attempt) => attempt.user_id));
  const successByLanguageCounts = new Map<
    string,
    { attempts: number; correct: number }
  >();
  for (const attempt of attempts) {
    const language =
      catalogLanguageBySourceKey.get(attempt.card_source_key) ??
      customLanguageBySourceKey.get(attempt.card_source_key) ??
      "unknown";
    const current = successByLanguageCounts.get(language) ?? {
      attempts: 0,
      correct: 0,
    };
    current.attempts += 1;
    if (attempt.is_correct) current.correct += 1;
    successByLanguageCounts.set(language, current);
  }

  const paidSubscriptionRows = subscriptions.filter(
    isAnalyticsActiveSubscription,
  );
  const paidSubscriptionCount = paidSubscriptionRows.length;
  const planCounts = new Map<string, number>([
    ["free", Math.max(0, totalUsers - paidSubscriptionCount)],
    ["basic", 0],
    ["pro", 0],
  ]);
  for (const subscription of paidSubscriptionRows) {
    if (subscription.plan === "basic" || subscription.plan === "pro") {
      planCounts.set(
        subscription.plan,
        (planCounts.get(subscription.plan) ?? 0) + 1,
      );
    }
  }
  const statusCounts = new Map<string, number>();
  for (const subscription of subscriptions) {
    const statusKey = !isAnalyticsActiveSubscription(subscription)
      ? "passive"
      : subscription.status === "cancelled"
        ? "cancelled"
        : "active";
    statusCounts.set(statusKey, (statusCounts.get(statusKey) ?? 0) + 1);
  }
  const billingCounts = new Map<string, number>();
  for (const subscription of paidSubscriptionRows) {
    if (subscription.billing_cycle)
      billingCounts.set(
        subscription.billing_cycle,
        (billingCounts.get(subscription.billing_cycle) ?? 0) + 1,
      );
  }
  const autoRenewCounts = new Map<string, number>([
    ["enabled", 0],
    ["disabled", 0],
  ]);
  for (const subscription of paidSubscriptionRows) {
    const key = subscription.auto_renew_enabled ? "enabled" : "disabled";
    autoRenewCounts.set(key, (autoRenewCounts.get(key) ?? 0) + 1);
  }

  const now = Date.now();
  const thirtyDaysFromNow = now + 30 * 24 * 60 * 60 * 1000;
  const mapRenewals = (
    kind: "renewal" | "expiry",
    getDate: (row: SubscriptionRow) => string | null,
  ) =>
    subscriptions
      .filter(isAnalyticsActiveSubscription)
      .map((row) => ({ row, date: getDate(row) }))
      .filter(
        (
          entry,
        ): entry is {
          row: SubscriptionRow & { plan: "basic" | "pro"; ends_at: string };
          date: string;
        } => entry.date !== null,
      )
      .filter((entry) => {
        const timestamp = new Date(entry.date).getTime();
        return timestamp >= now && timestamp <= thirtyDaysFromNow;
      })
      .sort(
        (left, right) =>
          new Date(left.date).getTime() - new Date(right.date).getTime(),
      )
      .slice(0, 10)
      .map(({ row, date }) => ({
        id: row.user_id,
        displayName: displayNameFor(row.user_id),
        email: emailFor(row.user_id),
        plan: row.plan,
        date,
        kind,
      }));

  const monthlyRevenueByPlan = ["basic", "pro"].map((plan) => ({
    key: plan,
    label: plan === "basic" ? "Basic" : "Pro",
    value: paidSubscriptionRows
      .filter((row) => row.plan === plan)
      .reduce((sum, row) => sum + asNumber(row.recurring_monthly_try), 0),
  }));
  const pricedPaidSubscriptions = paidSubscriptionRows.filter(
    (row) =>
      row.recurring_monthly_try !== null &&
      asNumber(row.recurring_monthly_try) > 0,
  );
  const monthlyRevenue = monthlyRevenueByPlan.reduce(
    (sum, item) => sum + item.value,
    0,
  );

  const transitionCounts = { basic: 0, pro: 0 };
  for (const event of rtdnEvents) {
    if (readRtdnNotificationType(event.payload) !== 4 || !event.user_id)
      continue;
    const plan = subscriptionsByUserId.get(event.user_id)?.plan;
    if (plan === "basic" || plan === "pro") transitionCounts[plan] += 1;
  }

  const topProducerCounts = new Map<string, number>();
  for (const card of customCards)
    topProducerCounts.set(
      card.user_id,
      (topProducerCounts.get(card.user_id) ?? 0) + 1,
    );
  const topProducers = [...topProducerCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([id, value]) => ({
      id,
      displayName: displayNameFor(id),
      email: emailFor(id),
      value,
    }));
  const createCardErrors = aiUsage.filter(
    (event) => event.event_type === "create_card_error",
  ).length;
  const dau = activeUsersInWindow(1);
  const wau = activeUsersInWindow(7);
  const mau = activeUsersInWindow(30);
  const activityDates = [
    ...loginEvents.map((event) => event.created_at),
    ...attempts.map((attempt) => attempt.created_at),
    ...cards.map((card) => card.added_at),
    ...aiUsage.map((event) => event.created_at),
    ...reviews.map((review) => review.created_at),
    ...customCards.map((card) => card.created_at),
  ].filter(Boolean);
  const lastActivityAt = activityDates.reduce<string | null>((latest, date) => {
    if (!latest || new Date(date).getTime() > new Date(latest).getTime())
      return date;
    return latest;
  }, null);
  const trackedEvents = activityDates.length;
  const errorEvents = aiUsage.filter((event) =>
    event.event_type.toLowerCase().includes("error"),
  ).length;
  const featureUsageCounts = [
    { key: "quiz", label: "Quiz", value: attempts.length },
    { key: "cards", label: "Kart ekleme", value: cards.length },
    {
      key: "ai_practice",
      label: "AI Practice",
      value: aiUsage.filter((event) => event.event_type === "chat").length,
    },
    {
      key: "ask",
      label: "Ask",
      value: aiUsage.filter((event) => event.event_type === "ask").length,
    },
    {
      key: "translate",
      label: "Çeviri",
      value: aiUsage.filter((event) => event.event_type === "translate").length,
    },
    {
      key: "custom_cards",
      label: "Özel kart üretimi",
      value: customCards.length,
    },
    { key: "reviews", label: "Review", value: reviews.length },
  ].filter((item) => item.value > 0);
  const totalFeatureUsage = featureUsageCounts.reduce(
    (sum, item) => sum + item.value,
    0,
  );
  const onboardingSteps = [
    { key: "registered", label: "Kayıt olan", value: totalUsers },
    { key: "profile", label: "Onboarding başlatan", value: profiles.length },
    {
      key: "completed",
      label: "Onboarding tamamlayan",
      value: profiles.filter((profile) => profile.onboarding_completed).length,
    },
    {
      key: "first_card",
      label: "İlk kartını alan",
      value: new Set(cards.map((card) => card.user_id)).size,
    },
    {
      key: "first_quiz",
      label: "İlk quizini yapan",
      value: usersWithQuiz.size,
    },
  ];

  return {
    totalUsers,
    dailyAppLogins: buildAnalyticsSeries(appLoginDates, "daily", 30),
    activity: {
      dau,
      wau,
      mau,
      stickinessPercent: mau > 0 ? Math.round((dau / mau) * 1000) / 10 : 0,
      dailyActiveUsers: buildUniqueUserSeries(
        retentionActivityEvents,
        "daily",
        30,
      ),
    },
    onboardingFunnel: onboardingSteps.map((step) => ({
      ...step,
      percent:
        totalUsers > 0 ? Math.round((step.value / totalUsers) * 1000) / 10 : 0,
    })),
    appHealth: {
      trackedEvents,
      errorEvents,
      errorRatePercent:
        aiUsage.length > 0
          ? Math.round((errorEvents / aiUsage.length) * 1000) / 10
          : 0,
      lastActivityAt,
      dataSource: trackedEvents > 0 ? "tracked_events" : "no_events",
    },
    featureUsage: featureUsageCounts.map((item) => ({
      ...item,
      percent:
        totalFeatureUsage > 0
          ? Math.round((item.value / totalFeatureUsage) * 1000) / 10
          : 0,
    })),
    retention: {
      activeUsers7d: activeUsersInWindow(7),
      activeUsers30d: activeUsersInWindow(30),
      returningUsers30d,
      dataSource:
        loginEvents.length > 0 ? "login_events" : "last_sign_in_fallback",
      metrics: retentionMetrics,
      cohorts: retentionCohorts,
    },
    registrations: {
      daily: buildAnalyticsSeries(userCreatedDates, "daily", 30),
      weekly: buildAnalyticsSeries(userCreatedDates, "weekly", 12),
      monthly: buildAnalyticsSeries(userCreatedDates, "monthly", 12),
    },
    nativeLanguageDistribution: buildAnalyticsDistribution(
      profileUiValues,
      analyticsLanguageLabel,
    ),
    learningLanguageDistribution: buildAnalyticsDistribution(
      profileLanguageValues,
      analyticsLanguageLabel,
    ),
    uiLocaleDistribution: buildAnalyticsDistribution(
      profileUiValues,
      analyticsLanguageLabel,
    ),
    recentLogins,
    cards: {
      addedDaily: buildAnalyticsSeries(addedCardDates, "daily", 30),
      addedWeekly: buildAnalyticsSeries(addedCardDates, "weekly", 12),
      learnedDaily: buildAnalyticsSeries(learnedCardDates, "daily", 30),
      learnedWeekly: buildAnalyticsSeries(learnedCardDates, "weekly", 12),
    },
    quiz: {
      totalAttempts,
      correctAttempts,
      incorrectAttempts: totalAttempts - correctAttempts,
      accuracyPercent:
        totalAttempts > 0
          ? Math.round((correctAttempts / totalAttempts) * 1000) / 10
          : 0,
      dailyActivity: buildAnalyticsSeries(attemptDates, "daily", 30),
      averageAttemptsPerUser:
        totalUsers > 0
          ? Math.round((totalAttempts / totalUsers) * 100) / 100
          : 0,
      firstQuizUsers: usersWithQuiz.size,
      firstQuizRatePercent:
        totalUsers > 0
          ? Math.round((usersWithQuiz.size / totalUsers) * 1000) / 10
          : 0,
      successByLanguage: [...successByLanguageCounts.entries()]
        .sort((left, right) => right[1].attempts - left[1].attempts)
        .map(([key, value]) => ({
          key,
          label: analyticsLanguageLabel(key),
          value: value.attempts,
          percent:
            value.attempts > 0
              ? Math.round((value.correct / value.attempts) * 1000) / 10
              : 0,
        })),
    },
    subscriptions: {
      byPlan: [...planCounts.entries()].map(([key, value]) => ({
        key,
        label: key === "free" ? "Free" : key === "basic" ? "Basic" : "Pro",
        value,
        percent:
          totalUsers > 0 ? Math.round((value / totalUsers) * 1000) / 10 : 0,
      })),
      googlePlayCount: paidSubscriptionRows.filter(
        (row) => row.provider === "google_play",
      ).length,
      byStatus: [...statusCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([key, value]) => ({
          key,
          label: key,
          value,
          percent:
            subscriptions.length > 0
              ? Math.round((value / subscriptions.length) * 1000) / 10
              : 0,
        })),
      byBillingCycle: [...billingCounts.entries()].map(([key, value]) => ({
        key,
        label: key === "monthly" ? "Aylık" : "Yıllık",
        value,
        percent:
          paidSubscriptionRows.length > 0
            ? Math.round((value / paidSubscriptionRows.length) * 1000) / 10
            : 0,
      })),
      autoRenew: [...autoRenewCounts.entries()].map(([key, value]) => ({
        key,
        label: key === "enabled" ? "Açık" : "Kapalı",
        value,
        percent:
          paidSubscriptionRows.length > 0
            ? Math.round((value / paidSubscriptionRows.length) * 1000) / 10
            : 0,
      })),
      upcomingRenewals: mapRenewals("renewal", (row) => row.renews_at),
      expiringUsers: mapRenewals("expiry", (row) => row.ends_at),
      monthlyRevenueByPlan,
      averageRevenuePerSubscription:
        pricedPaidSubscriptions.length > 0
          ? monthlyRevenue / pricedPaidSubscriptions.length
          : 0,
      freeToPaidTransitions: {
        ...transitionCounts,
        available: rtdnEvents.length > 0,
      },
    },
    reviews: {
      averageRating:
        reviews.length > 0
          ? Math.round(
              (reviews.reduce((sum, review) => sum + review.rating, 0) /
                reviews.length) *
                100,
            ) / 100
          : 0,
      daily: buildAnalyticsSeries(reviewDates, "daily", 30),
      weekly: buildAnalyticsSeries(reviewDates, "weekly", 12),
      distribution: buildAnalyticsDistribution(
        reviews.map((review) => String(review.rating)),
        (value) => `${value} yıldız`,
      ),
    },
    customCards: {
      topProducers,
      daily: buildAnalyticsSeries(customCardDates, "daily", 30),
      generationErrors: createCardErrors,
      generationErrorDataAvailable: false,
    },
  };
}

export async function getDeveloperContactReviews(): Promise<
  DeveloperContactReview[]
> {
  const supabase = createSupabaseAdminClient();
  const [
    { data: reviewRows, error: reviewError },
    { data: profileRows, error: profileError },
  ] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, user_id, rating, comment, created_at, updated_at")
      .order("created_at", { ascending: false })
      .returns<ReviewRow[]>(),
    supabase
      .from("user_profiles")
      .select(
        "user_id, display_name, profile_picture_index, preferred_language_code, preferred_ui_locale",
      )
      .returns<ReviewProfileRow[]>(),
  ]);

  if (reviewError) throw reviewError;
  if (profileError) throw profileError;

  const authUsers = await readAuthUsersByIdBestEffort(
    supabase,
    (reviewRows ?? []).map((review) => review.user_id),
  );
  const usersById = new Map(authUsers.map((user) => [user.id, user]));
  const profilesById = new Map(
    (profileRows ?? []).map((profile) => [profile.user_id, profile]),
  );

  return (reviewRows ?? []).map((review) => {
    const authUser = usersById.get(review.user_id);
    const profile = profilesById.get(review.user_id);

    return {
      id: review.id,
      userId: review.user_id,
      email: authUser?.email ?? null,
      displayName: profile?.display_name ?? null,
      profilePictureIndex: profile?.profile_picture_index ?? null,
      preferredLanguage: profile?.preferred_language_code ?? null,
      preferredUiLocale: profile?.preferred_ui_locale ?? null,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.created_at,
      updatedAt: review.updated_at,
    };
  });
}

export async function getDeveloperUsers(
  input: { page?: number; perPage?: number } = {},
): Promise<DeveloperUserPage> {
  void input;
  const supabase = createSupabaseAdminClient();

  const [profiles, subscriptions, cards, attempts, customCards] =
    await Promise.all([
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
          .select(
            "user_id, plan, status, provider, ends_at, billing_cycle, recurring_price_amount, recurring_price_currency, recurring_monthly_try, auto_renew_enabled, renews_at, updated_at",
          )
          .range(from, to)
          .returns<SubscriptionRow[]>(),
      ),
      readAllRows((from, to) =>
        supabase
          .from("user_cards")
          .select(
            "user_id, card_source_key, status, correct_count, added_at, learned_at",
          )
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
          .returns<
            Array<{ user_id: string; source_key: string; tier: string }>
          >(),
      ),
    ]);

  const authUsers = await readAuthUsersBestEffort(supabase);
  if (authUsers.length === 0 && profiles.length === 0) {
    return { users: [], page: 1, perPage: 40, total: 0 };
  }

  const profileByUserId = new Map(profiles.map((row) => [row.user_id, row]));
  const subscriptionByUserId = new Map(
    subscriptions.map((row) => [row.user_id, row]),
  );
  const customTierBySourceKey = new Map(
    customCards.map((row) => [row.source_key, parseTier(row.tier)]),
  );
  const cardTierBySourceKey = new Map(
    VOCABULARY_CARDS.map((card) => [card.sourceKey, card.tier]),
  );
  const cardMetrics = new Map<
    string,
    {
      active: number;
      learned: number;
      totalCorrect: number;
      learnedPoints: number;
      firstAddedAt: string | null;
      lastProgressAt: string | null;
    }
  >();
  for (const card of cards) {
    const current = cardMetrics.get(card.user_id) ?? {
      active: 0,
      learned: 0,
      totalCorrect: 0,
      learnedPoints: 0,
      firstAddedAt: null,
      lastProgressAt: null,
    };
    if (card.status === "learned") {
      current.learned += 1;
      const tier =
        parseTier(cardTierBySourceKey.get(card.card_source_key)) ??
        customTierBySourceKey.get(card.card_source_key);
      if (tier) current.learnedPoints += TIER_POINTS[tier];
    } else current.active += 1;
    current.totalCorrect += card.correct_count ?? 0;
    current.firstAddedAt =
      !current.firstAddedAt || card.added_at < current.firstAddedAt
        ? card.added_at
        : current.firstAddedAt;
    const progressAt = card.learned_at ?? card.added_at;
    current.lastProgressAt =
      !current.lastProgressAt || progressAt > current.lastProgressAt
        ? progressAt
        : current.lastProgressAt;
    cardMetrics.set(card.user_id, current);
  }
  const attemptMetrics = new Map<
    string,
    {
      total: number;
      correct: number;
      firstAttemptAt: string | null;
      lastAttemptAt: string | null;
    }
  >();
  for (const attempt of attempts) {
    const current = attemptMetrics.get(attempt.user_id) ?? {
      total: 0,
      correct: 0,
      firstAttemptAt: null,
      lastAttemptAt: null,
    };
    current.total += 1;
    if (attempt.is_correct) current.correct += 1;
    current.firstAttemptAt =
      !current.firstAttemptAt || attempt.created_at < current.firstAttemptAt
        ? attempt.created_at
        : current.firstAttemptAt;
    current.lastAttemptAt =
      !current.lastAttemptAt || attempt.created_at > current.lastAttemptAt
        ? attempt.created_at
        : current.lastAttemptAt;
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
    const counts = cardMetrics.get(userId) ?? {
      active: 0,
      learned: 0,
      totalCorrect: 0,
      learnedPoints: 0,
      firstAddedAt: null,
      lastProgressAt: null,
    };
    const attempts = attemptMetrics.get(userId) ?? {
      total: 0,
      correct: 0,
      firstAttemptAt: null,
      lastAttemptAt: null,
    };
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
      subscription && isAnalyticsActiveSubscription(subscription)
        ? subscription.plan
        : "free";
    return {
      id: userId,
      email: user?.email ?? "No email",
      displayName: profile?.display_name ?? null,
      preferredLanguage: profile?.preferred_language_code ?? null,
      preferredTier: profile?.preferred_tier ?? null,
      onboardingCompleted: profile?.onboarding_completed ?? false,
      createdAt:
        user?.created_at ?? profile?.created_at ?? new Date(0).toISOString(),
      lastSignInAt: user?.last_sign_in_at ?? null,
      emailConfirmedAt: user?.email_confirmed_at ?? null,
      phoneConfirmedAt: user?.phone_confirmed_at ?? null,
      providers: [
        ...new Set(
          (user?.identities ?? []).map((identity) => identity.provider),
        ),
      ],
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
      recurringPriceAmount:
        subscription?.recurring_price_amount == null
          ? null
          : asNumber(subscription.recurring_price_amount),
      recurringPriceCurrency: subscription?.recurring_price_currency ?? null,
      subscriptionUpdatedAt: subscription?.updated_at ?? null,
      recurringMonthlyTry:
        subscription?.recurring_monthly_try == null
          ? null
          : asNumber(subscription.recurring_monthly_try),
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
  const [
    { data: authResult, error: authError },
    profileResult,
    subscriptionResult,
    cardsResult,
    customCardsResult,
  ] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase
      .from("user_profiles")
      .select(
        "user_id, created_at, display_name, preferred_language_code, preferred_tier, onboarding_completed, preferred_ui_locale, theme, profile_picture_index, leaderboard_visible, push_marketing_enabled, ai_practice_points, chest_points, streak_points, mission_points, quiz_result_points, game_points, gem_points, blue_gems, green_gems, purple_gems",
      )
      .eq("user_id", userId)
      .maybeSingle<ProfileRow>(),
    supabase
      .from("user_subscriptions")
      .select(
        "user_id, plan, status, provider, ends_at, billing_cycle, recurring_price_amount, recurring_price_currency, recurring_monthly_try, auto_renew_enabled, renews_at, updated_at",
      )
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
  const tierStats = new Map<
    string,
    { total: number; learned: number; points: number }
  >();
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
  ].map((tier) => ({
    tier,
    ...(tierStats.get(tier) ?? { total: 0, learned: 0, points: 0 }),
  }));

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
      getEventSummary(supabase, "mission_rewards", userId, {
        column: "reward_type",
        value: "points",
      }),
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
    {
      key: "learned_cards",
      label: "Öğrenilmiş kartlar",
      points: learnedCardPoints,
      event: null,
    },
    {
      key: "ai_practice",
      label: "AI Practice",
      points: profilePoints.aiPracticePoints,
      event: pointEventResults[0],
    },
    {
      key: "chests",
      label: "Sandık ödülleri",
      points: profilePoints.chestPoints,
      event: pointEventResults[1],
    },
    {
      key: "quiz_streaks",
      label: "Quiz serileri",
      points: profilePoints.streakPoints,
      event: pointEventResults[2],
    },
    {
      key: "missions",
      label: "Misyonlar",
      points: profilePoints.missionPoints,
      event: pointEventResults[3],
    },
    {
      key: "quiz_results",
      label: "Quiz sonuçları",
      points: profilePoints.quizResultPoints,
      event: pointEventResults[4],
    },
    {
      key: "games",
      label: "Oyunlar",
      points: profilePoints.gamePoints,
      event: null,
    },
    {
      key: "gem_conversion",
      label: "Gem dönüşümleri",
      points: profilePoints.gemPoints,
      event: null,
    },
  ];
  const pointSources = pointSourceDefinitions.map(
    ({ key, label, points, event }) => ({
      key,
      label,
      points,
      eventCount: event?.count ?? null,
      lastEarnedAt: event?.lastEarnedAt ?? null,
    }),
  );
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
    createdAt:
      authUser?.created_at ?? profile?.created_at ?? new Date(0).toISOString(),
    lastSignInAt: authUser?.last_sign_in_at ?? null,
    emailConfirmedAt: authUser?.email_confirmed_at ?? null,
    phoneConfirmedAt: authUser?.phone_confirmed_at ?? null,
    providers: [
      ...new Set(
        (authUser?.identities ?? []).map((identity) => identity.provider),
      ),
    ],
    preferredUiLocale: profile?.preferred_ui_locale ?? null,
    theme: profile?.theme ?? null,
    profilePictureIndex: profile?.profile_picture_index ?? null,
    leaderboardVisible: profile?.leaderboard_visible ?? false,
    pushMarketingEnabled: profile?.push_marketing_enabled ?? false,
    plan:
      subscription && isAnalyticsActiveSubscription(subscription)
        ? subscription.plan
        : "free",
    status: subscription?.status ?? "free",
    provider:
      subscription?.provider === "google_play" ||
      subscription?.provider === "admin"
        ? subscription.provider
        : null,
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
    recurringPriceAmount:
      subscription?.recurring_price_amount == null
        ? null
        : asNumber(subscription.recurring_price_amount),
    recurringPriceCurrency: subscription?.recurring_price_currency ?? null,
    subscriptionUpdatedAt: subscription?.updated_at ?? null,
    recurringMonthlyTry:
      subscription?.recurring_monthly_try == null
        ? null
        : asNumber(subscription.recurring_monthly_try),
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
      providers: [
        ...new Set(
          (authUser?.identities ?? []).map((identity) => identity.provider),
        ),
      ],
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
          recurringPriceAmount:
            subscription.recurring_price_amount === null
              ? null
              : asNumber(subscription.recurring_price_amount),
          recurringPriceCurrency: subscription.recurring_price_currency,
          recurringMonthlyTry:
            subscription.recurring_monthly_try === null
              ? null
              : asNumber(subscription.recurring_monthly_try),
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
