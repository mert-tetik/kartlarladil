import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLeaderboardPayload } from "@/features/leaderboard/leaderboard-service";

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
          select: vi.fn(() => Promise.resolve({ data: profiles, error: null })),
        };
      }

      if (table === "custom_cards") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() =>
              Promise.resolve({
                data: [
                  { user_id: "user-5", source_key: "custom:user-5:card-1", tier: "B1" },
                ],
                error: null,
              }),
            ),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            eq: vi.fn(() =>
              Promise.resolve({
                data: [
                  { user_id: "user-3", card_source_key: "en:A1:learned" },
                  { user_id: "user-5", card_source_key: "custom:user-5:card-1" },
                ],
                error: null,
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
});
