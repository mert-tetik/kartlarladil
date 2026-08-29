import { vi } from "vitest";
import {
  assertAndRecordAiUsage,
  assertCanUseAi,
  recordAiUsageEvent,
} from "@/features/subscriptions/ai-usage-service";

const mockCount = vi.fn();
const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
const mockRpc = vi.fn<(...args: unknown[]) => Promise<{ data: string | null; error: Error | null }>>(
  () => Promise.resolve({ data: "ok", error: null }),
);

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() =>
    ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => Promise.resolve({ count: mockCount(), error: null })),
          })),
        })),
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
    mockCount.mockReturnValueOnce(149).mockReturnValueOnce(4499);

    expect(await assertCanUseAi("user-3", "pro")).toBeNull();

    mockCount.mockReturnValueOnce(150).mockReturnValueOnce(4499);

    expect(await assertCanUseAi("user-3", "pro")).toBe("ai_daily_limit");
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
      p_plan: "free",
      p_daily_limit: 10,
      p_monthly_limit: 200,
    });
  });

  it("supports the ask event type", async () => {
    await recordAiUsageEvent("user-1", "basic", "ask");

    expect(mockRpc).toHaveBeenCalledWith("record_ai_usage_if_within_limit", {
      p_user_id: "user-1",
      p_event_type: "ask",
      p_plan: "basic",
      p_daily_limit: 30,
      p_monthly_limit: 900,
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
      p_plan: "free",
      p_daily_limit: 10,
      p_monthly_limit: 200,
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
