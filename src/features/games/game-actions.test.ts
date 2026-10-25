import { beforeEach, describe, expect, it, vi } from "vitest";
import { addGamePointsAction } from "@/features/games/game-actions";
import { getPointsForLevel } from "@/features/games/game-levels";

const { mockRequireAuthUser, mockGetUserEntitlements, mockRpc } = vi.hoisted(() => ({
  mockRequireAuthUser: vi.fn(),
  mockGetUserEntitlements: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/features/auth/auth-session", () => ({
  requireAuthUser: mockRequireAuthUser,
}));

vi.mock("@/features/subscriptions/subscription-service", () => ({
  getUserEntitlements: mockGetUserEntitlements,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc: mockRpc }),
}));

describe("addGamePointsAction", () => {
  beforeEach(() => {
    mockRequireAuthUser.mockReset().mockResolvedValue({ id: "user-1" });
    mockGetUserEntitlements.mockReset().mockResolvedValue({ effectivePlan: "free" });
    mockRpc.mockReset().mockResolvedValue({ error: null });
  });

  it("rejects paid-level rewards for Free accounts before writing points", async () => {
    const result = await addGamePointsAction(16);

    expect(result).toEqual({ status: "error", message: "game_level_locked" });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("allows paid accounts to claim locked-level rewards using server-calculated points", async () => {
    mockGetUserEntitlements.mockResolvedValue({ effectivePlan: "pro" });

    const result = await addGamePointsAction(16);

    expect(result).toEqual({ status: "success" });
    expect(mockRpc).toHaveBeenCalledWith("increment_game_points", {
      p_user_id: "user-1",
      p_points: getPointsForLevel(16),
    });
  });

  it("does not query subscription entitlements for free levels", async () => {
    const result = await addGamePointsAction(15);

    expect(result).toEqual({ status: "success" });
    expect(mockGetUserEntitlements).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith("increment_game_points", {
      p_user_id: "user-1",
      p_points: getPointsForLevel(15),
    });
  });

  it("rejects malformed level values before authenticating or writing", async () => {
    const result = await addGamePointsAction(0);

    expect(result).toEqual({ status: "error", message: "invalid_level" });
    expect(mockRequireAuthUser).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
