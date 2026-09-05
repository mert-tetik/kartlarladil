import { beforeEach, describe, expect, it, vi } from "vitest";
import { awardChestPoints, awardQuizResultPoints } from "@/features/quiz/actions";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockAdminRpc = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    }),
  ),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({ rpc: mockAdminRpc })),
}));

describe("awardQuizResultPoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: true, error: null });
  });

  it("rejects invalid session ids and star values before contacting Supabase", async () => {
    await expect(awardQuizResultPoints("not-a-uuid", 3)).resolves.toEqual({
      success: false,
      error: "invalid_session",
    });
    await expect(
      awardQuizResultPoints("00000000-0000-4000-8000-000000000003", 6, 10),
    ).resolves.toEqual({
      success: false,
      error: "invalid_points",
    });

    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("passes the session and star reward to the idempotent RPC", async () => {
    const sessionId = "00000000-0000-4000-8000-000000000004";

    await expect(awardQuizResultPoints(sessionId, 4, 10)).resolves.toEqual({
      success: true,
      awarded: true,
      points: 8,
    });

    expect(mockRpc).toHaveBeenCalledWith("award_quiz_result_points", {
      p_user_id: "user-1",
      p_session_id: sessionId,
      p_stars: 4,
      p_card_count: 10,
    });
  });

  it("reports a duplicate session without claiming another reward", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });

    await expect(
      awardQuizResultPoints("00000000-0000-4000-8000-000000000005", 2, 20),
    ).resolves.toEqual({
      success: true,
      awarded: false,
      points: 8,
    });
  });
});

describe("awardChestPoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockAdminRpc.mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          awarded: true,
          points: 60,
          rewards: [
            { type: "purple", amount: 1 },
            { type: "blue", amount: 4 },
            { type: "green", amount: 2 },
          ],
          blue_gems: 14,
          green_gems: 5,
          purple_gems: 1,
        },
        error: null,
      }),
    });
  });

  it("returns every independently dropped gem and calls the multi-reward RPC", async () => {
    const sessionId = "00000000-0000-4000-8000-000000000006";

    await expect(awardChestPoints("gold", sessionId)).resolves.toEqual({
      success: true,
      awarded: true,
      points: 60,
      gemRewards: [
        { type: "blue", amount: 4 },
        { type: "green", amount: 2 },
        { type: "purple", amount: 1 },
      ],
      gemType: "blue",
      gemAmount: 4,
      balances: { blue: 14, green: 5, purple: 1 },
    });
    expect(mockAdminRpc).toHaveBeenCalledWith("award_chest_rewards", {
      p_user_id: "user-1",
      p_claim_key: `quiz:${sessionId}`,
      p_tier: "gold",
      p_points: 60,
    });
  });
});
