import { NextRequest, NextResponse } from "next/server";
import { hasDeveloperAdminRequest } from "@/features/developer/developer-auth";
import { getDeveloperLeaderboardRows } from "@/features/leaderboard/leaderboard-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 25;
const BOARDS = [
  "points",
  "streaks",
  "medals",
  "app_entries",
  "learned_cards",
  "quiz_attempts",
  "quiz_accuracy",
] as const;
type BoardKey = (typeof BOARDS)[number];

interface ProfileRow {
  user_id: string;
  display_name: string | null;
}

interface CardRow {
  user_id: string;
  status: string;
}

interface AttemptRow {
  user_id: string;
  is_correct: boolean;
}

interface AppLoginEventRow {
  user_id: string;
}

interface DailyLoginRow {
  user_id: string;
  activity_date: string;
}

interface LeaderboardStats {
  points: number;
  streak: number;
  medals: number;
  activeDays: number;
  appEntries: number | null;
  learnedCards: number;
  quizAttempts: number;
  quizCorrect: number;
  quizAccuracy: number | null;
}

type LeaderboardRanks = Partial<Record<BoardKey, number>>;

interface RankedValue {
  userId: string;
  displayName: string;
  value: number;
  secondaryValue: number | null;
  stats: LeaderboardStats;
}

interface LeaderboardEntry extends RankedValue {
  rank: number;
  ranks: LeaderboardRanks;
}

interface AnalyticsSnapshot {
  names: Map<string, string | null>;
  stats: Map<string, LeaderboardStats>;
  gameRows: Awaited<ReturnType<typeof getDeveloperLeaderboardRows>>;
}

function isBoardKey(value: string | null): value is BoardKey {
  return Boolean(value && BOARDS.includes(value as BoardKey));
}

function readOffset(request: NextRequest) {
  const value = Number(request.nextUrl.searchParams.get("offset") ?? "0");
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function readLimit(request: NextRequest) {
  const value = Number(request.nextUrl.searchParams.get("limit") ?? PAGE_SIZE);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), MAX_PAGE_SIZE) : PAGE_SIZE;
}

async function readAllRows<T>(
  loadPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await loadPage(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

function createEmptyStats(): LeaderboardStats {
  return {
    points: 0,
    streak: 0,
    medals: 0,
    activeDays: 0,
    appEntries: null,
    learnedCards: 0,
    quizAttempts: 0,
    quizCorrect: 0,
    quizAccuracy: null,
  };
}

function getOrCreateStats(stats: Map<string, LeaderboardStats>, userId: string) {
  const current = stats.get(userId) ?? createEmptyStats();
  stats.set(userId, current);
  return current;
}

async function readAppEntryScores(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const dailyLogins = await readAllRows((from, to) =>
    admin
      .from("user_daily_logins")
      .select("user_id, activity_date")
      .range(from, to)
      .returns<DailyLoginRow[]>(),
  );
  const activeDays = new Map<string, number>();

  for (const login of dailyLogins) {
    activeDays.set(login.user_id, (activeDays.get(login.user_id) ?? 0) + 1);
  }

  let events: AppLoginEventRow[] = [];

  try {
    events = await readAllRows((from, to) =>
      admin
        .from("app_login_events")
        .select("user_id")
        .range(from, to)
        .returns<AppLoginEventRow[]>(),
    );
  } catch (error) {
    // Older environments may not have the optional event stream migration yet.
    console.warn("[developer.analytics.leaderboards] app_login_events unavailable", error);
  }

  const appEntries = new Map<string, number>();
  for (const event of events) {
    appEntries.set(event.user_id, (appEntries.get(event.user_id) ?? 0) + 1);
  }

  return new Map(
    [...new Set([...activeDays.keys(), ...appEntries.keys()])].map((userId) => [userId, {
      activeDays: activeDays.get(userId) ?? 0,
      appEntries: appEntries.get(userId) ?? null,
    }]),
  );
}

async function readAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const admin = createSupabaseAdminClient();
  const [gameRows, profiles, cards, attempts, appEntryScores] = await Promise.all([
    getDeveloperLeaderboardRows("points"),
    readAllRows((from, to) =>
      admin.from("user_profiles").select("user_id, display_name").range(from, to).returns<ProfileRow[]>(),
    ),
    readAllRows((from, to) =>
      admin.from("user_cards").select("user_id, status").eq("status", "learned").range(from, to).returns<CardRow[]>(),
    ),
    readAllRows((from, to) =>
      admin.from("practice_attempts").select("user_id, is_correct").range(from, to).returns<AttemptRow[]>(),
    ),
    readAppEntryScores(admin),
  ]);

  const names = new Map(profiles.map((profile) => [profile.user_id, profile.display_name?.trim() || null]));
  const stats = new Map<string, LeaderboardStats>();

  for (const row of gameRows) {
    const current = getOrCreateStats(stats, row.userId);
    current.points = row.totalPoints;
    current.streak = row.streak;
    current.medals = row.medals;
  }

  for (const card of cards) {
    getOrCreateStats(stats, card.user_id).learnedCards += 1;
  }

  for (const attempt of attempts) {
    const current = getOrCreateStats(stats, attempt.user_id);
    current.quizAttempts += 1;
    if (attempt.is_correct) current.quizCorrect += 1;
  }

  for (const [userId, score] of appEntryScores) {
    const current = getOrCreateStats(stats, userId);
    current.activeDays = score.activeDays;
    current.appEntries = score.appEntries;
  }

  for (const current of stats.values()) {
    current.quizAccuracy = current.quizAttempts > 0
      ? Math.round((current.quizCorrect / current.quizAttempts) * 1000) / 10
      : null;
  }

  return { names, stats, gameRows };
}

function sortRankedValues(entries: RankedValue[]) {
  return entries.sort((left, right) =>
    right.value - left.value ||
    (right.secondaryValue ?? 0) - (left.secondaryValue ?? 0) ||
    left.userId.localeCompare(right.userId),
  );
}

function rankEntries(snapshot: AnalyticsSnapshot, board: BoardKey) {
  const nameFor = (userId: string) => snapshot.names.get(userId) ?? "İsimsiz kullanıcı";
  const statsFor = (userId: string) => snapshot.stats.get(userId) ?? createEmptyStats();
  const withValue = (userId: string, value: number, secondaryValue: number | null = null): RankedValue => ({
    userId,
    displayName: nameFor(userId),
    value,
    secondaryValue,
    stats: statsFor(userId),
  });

  if (board === "points" || board === "streaks" || board === "medals") {
    return sortRankedValues(snapshot.gameRows.map((row) => withValue(
      row.userId,
      board === "points" ? row.totalPoints : board === "streaks" ? row.streak : row.medals,
    )));
  }

  if (board === "app_entries") {
    return sortRankedValues([...snapshot.stats.entries()]
      .filter(([, stats]) => stats.activeDays > 0 || stats.appEntries !== null)
      .map(([userId, stats]) => withValue(userId, stats.activeDays, stats.appEntries)));
  }

  if (board === "learned_cards") {
    return sortRankedValues([...snapshot.stats.entries()]
      .filter(([, stats]) => stats.learnedCards > 0)
      .map(([userId, stats]) => withValue(userId, stats.learnedCards)));
  }

  if (board === "quiz_attempts") {
    return sortRankedValues([...snapshot.stats.entries()]
      .filter(([, stats]) => stats.quizAttempts > 0)
      .map(([userId, stats]) => withValue(userId, stats.quizAttempts, stats.quizCorrect)));
  }

  const accuracyCandidates = [...snapshot.stats.entries()].filter(([, stats]) => stats.quizAttempts > 0);
  const qualifiedCandidates = accuracyCandidates.filter(([, stats]) => stats.quizAttempts >= 5);
  const candidates = qualifiedCandidates.length > 0 ? qualifiedCandidates : accuracyCandidates;
  return sortRankedValues(candidates.map(([userId, stats]) => withValue(
    userId,
    stats.quizAccuracy ?? 0,
    stats.quizAttempts,
  )));
}

function getRanksByUser(lists: Record<BoardKey, RankedValue[]>) {
  const ranksByUser = new Map<string, LeaderboardRanks>();

  for (const board of BOARDS) {
    lists[board].forEach((entry, index) => {
      const ranks = ranksByUser.get(entry.userId) ?? {};
      ranks[board] = index + 1;
      ranksByUser.set(entry.userId, ranks);
    });
  }

  return ranksByUser;
}

export async function GET(request: NextRequest) {
  if (!(await hasDeveloperAdminRequest(request.headers.get("cookie")))) {
    return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  }

  const board = request.nextUrl.searchParams.get("board");
  if (!isBoardKey(board)) {
    return NextResponse.json({ errorCode: "invalid_board" }, { status: 400 });
  }

  const offset = readOffset(request);
  const limit = readLimit(request);

  try {
    const snapshot = await readAnalyticsSnapshot();
    const lists = Object.fromEntries(BOARDS.map((key) => [key, rankEntries(snapshot, key)])) as Record<BoardKey, RankedValue[]>;
    const ranksByUser = getRanksByUser(lists);
    const ranked = lists[board];
    const entries: LeaderboardEntry[] = ranked.slice(offset, offset + limit).map((entry, index) => ({
      ...entry,
      rank: offset + index + 1,
      ranks: ranksByUser.get(entry.userId) ?? {},
    }));

    return NextResponse.json({
      board,
      entries,
      total: ranked.length,
      nextOffset: offset + entries.length < ranked.length ? offset + entries.length : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[developer.analytics.leaderboards] Failed to load leaderboard", {
      board,
      offset,
      limit,
      error,
    });
    return NextResponse.json({ errorCode: "leaderboard_unavailable" }, { status: 503 });
  }
}
