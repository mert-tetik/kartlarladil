import { vi } from "vitest";
import {
  assertAndRecordAiUsage,
  assertCanUseAi,
  consumeImageTextTranslation,
  getImageTextTranslationUsage,
  recordAiUsageEvent,
} from "@/features/subscriptions/ai-usage-service";

const mockCount = vi.fn();
const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
const mockRpc = vi.fn<(...args: unknown[]) => Promise<{ data: string | null; error: Error | null }>>(
  () => Promise.resolve({ data: "ok", error: null }),
);
const mockQuery = {
  eq: vi.fn(() => mockQuery),
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

  it("counts each feature independently", async () => {
    mockCount.mockReturnValueOnce(10).mockReturnValueOnce(0);

    expect(await assertCanUseAi("user-4", "free", "chat")).toBe("ai_daily_limit");
    expect(await assertCanUseAi("user-4", "free", "ask")).toBeNull();
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

    await expect(assertAndRecordAiUsage("user-1", "free", "chat")).rejects.toThrow("db error");
  });
});

describe("image text translation usage", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ data: "ok", error: null });
    mockCount.mockReset();
  });

  it("uses the dedicated atomic RPC", async () => {
    await consumeImageTextTranslation("user-1");

    expect(mockRpc).toHaveBeenCalledWith("record_image_text_translation_if_available", {
      p_user_id: "user-1",
    });
  });

  it("returns a restriction code when the lifetime cap is reached", async () => {
    mockRpc.mockResolvedValue({ data: "feature_limit", error: null });

    await expect(consumeImageTextTranslation("user-1")).resolves.toBe("image_text_translate_limit");
  });

  it("rejects an unexpected RPC result instead of treating usage as recorded", async () => {
    mockRpc.mockResolvedValue({ data: "", error: null });

    await expect(consumeImageTextTranslation("user-1")).rejects.toThrow(
      "unexpected_image_text_translation_usage_result",
    );
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
