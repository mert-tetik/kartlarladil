import { beforeEach, describe, expect, it, vi } from "vitest";
import { awardQuizResultPoints } from "@/features/quiz/actions";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

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
      awardQuizResultPoints("00000000-0000-4000-8000-000000000003", 6),
    ).resolves.toEqual({
      success: false,
      error: "invalid_points",
    });

    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("passes the session and star reward to the idempotent RPC", async () => {
    const sessionId = "00000000-0000-4000-8000-000000000004";

    await expect(awardQuizResultPoints(sessionId, 4)).resolves.toEqual({
      success: true,
      awarded: true,
      points: 4,
    });

    expect(mockRpc).toHaveBeenCalledWith("award_quiz_result_points", {
      p_user_id: "user-1",
      p_session_id: sessionId,
      p_stars: 4,
    });
  });

  it("reports a duplicate session without claiming another reward", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });

    await expect(
      awardQuizResultPoints("00000000-0000-4000-8000-000000000005", 2),
    ).resolves.toEqual({
      success: true,
      awarded: false,
      points: 2,
    });
  });
});
