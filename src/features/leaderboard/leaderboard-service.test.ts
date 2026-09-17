import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateLongestDailyStreak,
  getLeaderboardPayload,
} from "@/features/leaderboard/leaderboard-service";

const mockCreateSupabaseAdminClient = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient,
}));

const profiles = [
  {
    user_id: "user-1",
    display_name: "Viewer",
    ai_practice_points: 0,
    chest_points: 0,
    streak_points: 0,
    mission_points: 0,
    quiz_result_points: 7,
    leaderboard_visible: true,
    profile_picture_index: null,
  },
  {
    user_id: "user-2",
    display_name: "Ahead by mission points",
    ai_practice_points: 0,
    chest_points: 0,
    streak_points: 0,
    mission_points: 10,
    quiz_result_points: 0,
    leaderboard_visible: true,
    profile_picture_index: null,
  },
  {
    user_id: "user-3",
    display_name: "Ahead by learned card",
    ai_practice_points: 0,
    chest_points: 0,
    streak_points: 0,
    mission_points: 0,
    quiz_result_points: 0,
    leaderboard_visible: true,
    profile_picture_index: null,
  },
  {
    user_id: "user-4",
    display_name: "Behind",
    ai_practice_points: 3,
    chest_points: 0,
    streak_points: 0,
    mission_points: 0,
    quiz_result_points: 0,
    leaderboard_visible: true,
    profile_picture_index: null,
  },
  {
    user_id: "user-5",
    display_name: "Ahead by custom learned card",
    ai_practice_points: 0,
    chest_points: 0,
    streak_points: 0,
    mission_points: 0,
    quiz_result_points: 0,
    leaderboard_visible: true,
    profile_picture_index: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateSupabaseAdminClient.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "user_profiles") {
        return {
          select: vi.fn(() => ({
            range: vi.fn(() => ({
              returns: vi.fn(() => Promise.resolve({ data: profiles, error: null })),
            })),
          })),
        };
      }

      if (table === "custom_cards") {
        return {
          select: vi.fn(() => ({
            range: vi.fn(() => ({
              returns: vi.fn(() =>
                Promise.resolve({
                  data: [
                    { user_id: "user-5", source_key: "custom:user-5:card-1", tier: "B1" },
                  ],
                  error: null,
                }),
              ),
            })),
          })),
        };
      }

      if (table === "user_daily_logins") {
        return {
          select: vi.fn(() => ({
            range: vi.fn(() => ({
              returns: vi.fn(() =>
                Promise.resolve({
                  data: [
                    { user_id: "user-1", activity_date: "2026-09-01" },
                    { user_id: "user-1", activity_date: "2026-09-02" },
                    { user_id: "user-1", activity_date: "2026-09-03" },
                    { user_id: "user-1", activity_date: "2026-09-05" },
                    { user_id: "user-2", activity_date: "2026-09-01" },
                    { user_id: "user-2", activity_date: "2026-09-02" },
                    { user_id: "user-4", activity_date: "2026-09-10" },
                    { user_id: "user-5", activity_date: "2026-09-01" },
                    { user_id: "user-5", activity_date: "2026-09-02" },
                    { user_id: "user-5", activity_date: "2026-09-03" },
                  ],
                  error: null,
                }),
              ),
            })),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            range: vi.fn(() => ({
              returns: vi.fn(() =>
                Promise.resolve({
                  data: [
                    { user_id: "user-3", card_source_key: "en:A1:learned" },
                    { user_id: "user-5", card_source_key: "custom:user-5:card-1" },
                  ],
                  error: null,
                }),
              ),
            })),
          })),
        })),
      };
    }),
  });
});

describe("getLeaderboardPayload", () => {
  it("includes quiz result points before sorting the viewer into the current order", async () => {
    const payload = await getLeaderboardPayload("user-1");

    expect(payload.viewer).toMatchObject({
      userId: "user-1",
      totalPoints: 7,
      position: 4,
      pointsPosition: 4,
      streakPosition: 1,
    });
    expect(payload.entries.map((entry) => [entry.userId, entry.totalPoints, entry.position])).toEqual([
      ["user-5", 40, 1],
      ["user-2", 10, 2],
      ["user-3", 10, 3],
      ["user-1", 7, 4],
      ["user-4", 3, 5],
    ]);
  });

  it("uses a stable user id tie-breaker when two users have the same points", async () => {
    const payload = await getLeaderboardPayload("user-3");

    expect(payload.viewer.position).toBe(3);
    expect(payload.entries.map((entry) => entry.userId)).toEqual([
      "user-5",
      "user-2",
      "user-3",
      "user-1",
      "user-4",
    ]);
  });

  it("ranks users by their highest consecutive daily streak", async () => {
    const payload = await getLeaderboardPayload("user-1", "streaks");

    expect(payload.mode).toBe("streaks");
    expect(payload.viewer).toMatchObject({
      userId: "user-1",
      streak: 3,
      position: 1,
      pointsPosition: 4,
      streakPosition: 1,
    });
    expect(payload.entries.map((entry) => [entry.userId, entry.streak, entry.position])).toEqual([
      ["user-1", 3, 1],
      ["user-5", 3, 2],
      ["user-2", 2, 3],
      ["user-4", 1, 4],
      ["user-3", 0, 5],
    ]);
  });

  it("ignores duplicate and invalid dates when finding the longest streak", () => {
    expect(
      calculateLongestDailyStreak([
        "2026-09-01",
        "2026-09-02",
        "2026-09-02",
        "2026-09-04",
        "not-a-date",
      ]),
    ).toBe(2);
  });
});
