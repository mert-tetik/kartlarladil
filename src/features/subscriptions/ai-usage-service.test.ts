import { vi } from "vitest";
import {
  assertAndRecordAiUsage,
  assertCanUseAi,
  completeImageTextTranslation,
  getImageTextTranslationUsage,
  releaseImageTextTranslation,
  recordAiUsageEvent,
  reserveImageTextTranslation,
} from "@/features/subscriptions/ai-usage-service";
import { getAiFeatureLimit } from "@/features/subscriptions/subscription-limits";

const mockCount = vi.fn();
const mockIn = vi.fn(() => mockQuery);
const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
const mockRpc = vi.fn<(...args: unknown[]) => Promise<{ data: string | null; error: Error | null }>>(
  () => Promise.resolve({ data: "ok", error: null }),
);
const mockQuery = {
  eq: vi.fn(() => mockQuery),
  in: mockIn,
  gte: vi.fn(() => Promise.resolve({ count: mockCount(), error: null })),
  then: (resolve: (value: { count: number; error: null }) => unknown) =>
    Promise.resolve({ count: mockCount(), error: null }).then(resolve),
};

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() =>
    ({
      from: vi.fn(() => ({
        select: vi.fn(() => mockQuery),
        insert: mockInsert,
      })),
      rpc: mockRpc,
    }),
  ),
}));

describe("assertCanUseAi", () => {
  beforeEach(() => {
    mockCount.mockReset();
    mockIn.mockClear();
    mockQuery.eq.mockClear();
    mockInsert.mockClear();
    mockRpc.mockClear();
  });

  it("allows usage when counts are below the free limits", async () => {
    mockCount.mockReturnValueOnce(5).mockReturnValueOnce(50);

    const result = await assertCanUseAi("user-1", "free");

    expect(result).toBeNull();
  });

  it("returns ai_daily_limit when the daily cap is reached", async () => {
    mockCount.mockReturnValueOnce(10).mockReturnValueOnce(50);

    const result = await assertCanUseAi("user-1", "free");

    expect(result).toBe("ai_daily_limit");
  });

  it("returns ai_monthly_limit when the monthly cap is reached", async () => {
    mockCount.mockReturnValueOnce(5).mockReturnValueOnce(200);

    const result = await assertCanUseAi("user-1", "free");

    expect(result).toBe("ai_monthly_limit");
  });

  it("uses the basic plan limits", async () => {
    mockCount.mockReturnValueOnce(29).mockReturnValueOnce(899);

    expect(await assertCanUseAi("user-2", "basic")).toBeNull();

    mockCount.mockReturnValueOnce(30).mockReturnValueOnce(899);

    expect(await assertCanUseAi("user-2", "basic")).toBe("ai_daily_limit");
  });

  it("uses the pro plan limits", async () => {
    expect(await assertCanUseAi("user-3", "pro")).toBeNull();
    expect(mockCount).not.toHaveBeenCalled();
  });

  it("shares the advertised AI quota across chat, translation, and Ask", async () => {
    mockCount.mockReturnValueOnce(10).mockReturnValueOnce(0);

    expect(await assertCanUseAi("user-4", "free", "ask")).toBe("ai_daily_limit");
    expect(mockIn).toHaveBeenCalledWith("event_type", ["chat", "translate", "ask"]);
  });

  it("enforces the shared monthly cap when usage is split across AI features", async () => {
    mockCount.mockReturnValueOnce(4).mockReturnValueOnce(900);

    expect(await assertCanUseAi("user-4", "basic", "translate")).toBe("ai_monthly_limit");
    expect(mockIn).toHaveBeenCalledWith("event_type", ["chat", "translate", "ask"]);
  });

  it("keeps quiz-answer validation on its separate daily quota", async () => {
    mockCount.mockReturnValueOnce(15).mockReturnValueOnce(120);

    expect(await assertCanUseAi("user-4", "free", "quiz_validate")).toBe("ai_daily_limit");
    expect(mockIn).toHaveBeenCalledWith("event_type", ["quiz_validate"]);
  });

  it("matches the Free quiz-validation cap and leaves paid plans unlimited", () => {
    expect(getAiFeatureLimit("free", "quiz_validate")).toEqual({ daily: 15, monthly: null });
    expect(getAiFeatureLimit("basic", "quiz_validate")).toEqual({ daily: null, monthly: null });
    expect(getAiFeatureLimit("pro", "quiz_validate")).toEqual({ daily: null, monthly: null });
  });

  it("enforces the Free quiz-validation cap from usage counts", async () => {
    mockCount.mockReturnValueOnce(14).mockReturnValueOnce(120);
    expect(await assertCanUseAi("user-5", "free", "quiz_validate")).toBeNull();
    mockCount.mockReturnValueOnce(15).mockReturnValueOnce(120);
    expect(await assertCanUseAi("user-5", "free", "quiz_validate")).toBe("ai_daily_limit");
  });
});

describe("recordAiUsageEvent", () => {
  beforeEach(() => {
    mockRpc.mockClear();
  });

  it("records an event through the server-only atomic RPC", async () => {
    await recordAiUsageEvent("user-1", "free", "chat");

    expect(mockRpc).toHaveBeenCalledWith("record_ai_usage_if_within_limit", {
      p_user_id: "user-1",
      p_event_type: "chat",
    });
  });

  it("supports the ask event type", async () => {
    await recordAiUsageEvent("user-1", "basic", "ask");

    expect(mockRpc).toHaveBeenCalledWith("record_ai_usage_if_within_limit", {
      p_user_id: "user-1",
      p_event_type: "ask",
    });
  });

  it("fails closed when the usage RPC returns an unknown result", async () => {
    mockRpc.mockResolvedValue({ data: "unexpected", error: null });

    await expect(recordAiUsageEvent("user-1", "free", "chat")).rejects.toThrow(
      "unexpected_ai_usage_result",
    );
  });
});

describe("assertAndRecordAiUsage", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("returns null and records usage when within limits", async () => {
    mockRpc.mockResolvedValue({ data: "ok", error: null });

    const result = await assertAndRecordAiUsage("user-1", "free", "chat");

    expect(result).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith("record_ai_usage_if_within_limit", {
      p_user_id: "user-1",
      p_event_type: "chat",
    });
  });

  it("returns ai_daily_limit when the atomic RPC reports daily limit", async () => {
    mockRpc.mockResolvedValue({ data: "daily_limit", error: null });

    const result = await assertAndRecordAiUsage("user-1", "free", "chat");

    expect(result).toBe("ai_daily_limit");
  });

  it("returns ai_monthly_limit when the atomic RPC reports monthly limit", async () => {
    mockRpc.mockResolvedValue({ data: "monthly_limit", error: null });

    const result = await assertAndRecordAiUsage("user-1", "free", "chat");

    expect(result).toBe("ai_monthly_limit");
  });

  it("throws when the RPC call fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error("db error") });

    await expect(assertAndRecordAiUsage("user-1", "free", "chat")).rejects.toThrow(
      "subscription_service_unavailable",
    );
  });

  it("fails closed when the quota RPC returns an unknown result", async () => {
    mockRpc.mockResolvedValue({ data: "unexpected", error: null });

    await expect(assertAndRecordAiUsage("user-1", "free", "chat")).rejects.toThrow(
      "unexpected_ai_usage_result",
    );
  });
});

describe("image text translation usage", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ data: "ok", error: null });
    mockCount.mockReset();
  });

  it("reserves a quota slot through the dedicated atomic RPC", async () => {
    const reservationId = "7b14850b-021e-4b37-a035-6ab40853c276";
    mockRpc.mockResolvedValue({ data: reservationId, error: null });

    await expect(reserveImageTextTranslation("user-1")).resolves.toEqual({
      status: "reserved",
      reservationId,
    });
    expect(mockRpc).toHaveBeenCalledWith("reserve_image_text_translation", {
      p_user_id: "user-1",
    });
  });

  it("returns a restriction when the lifetime cap is reached", async () => {
    mockRpc.mockResolvedValue({ data: "feature_limit", error: null });

    await expect(reserveImageTextTranslation("user-1")).resolves.toEqual({ status: "limit" });
  });

  it("rejects an unexpected RPC result instead of treating usage as recorded", async () => {
    mockRpc.mockResolvedValue({ data: "", error: null });

    await expect(reserveImageTextTranslation("user-1")).rejects.toThrow(
      "unexpected_image_text_translation_reservation_result",
    );
  });

  it("completes a reservation as a successful usage event", async () => {
    mockRpc.mockResolvedValue({ data: "ok", error: null });

    await expect(completeImageTextTranslation("user-1", "reservation-1")).resolves.toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith("complete_image_text_translation", {
      p_user_id: "user-1",
      p_reservation_id: "reservation-1",
    });
  });

  it("releases a reservation after an unsuccessful request", async () => {
    mockRpc.mockResolvedValue({ data: "ok", error: null });

    await expect(releaseImageTextTranslation("user-1", "reservation-1")).resolves.toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith("release_image_text_translation", {
      p_user_id: "user-1",
      p_reservation_id: "reservation-1",
    });
  });

  it("reports remaining free-plan translation uses", async () => {
    mockCount.mockReturnValueOnce(1);

    await expect(getImageTextTranslationUsage("user-1", "free")).resolves.toEqual({
      used: 1,
      limit: 2,
      remaining: 1,
      canUse: true,
    });
  });

  it("does not query usage for Pro", async () => {
    await expect(getImageTextTranslationUsage("user-1", "pro")).resolves.toEqual({
      used: 0,
      limit: null,
      remaining: null,
      canUse: true,
    });
    expect(mockCount).not.toHaveBeenCalled();
  });
});
