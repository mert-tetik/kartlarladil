import { vi } from "vitest";
import {
  assertCanUseAi,
  recordAiUsageEvent,
} from "@/features/subscriptions/ai-usage-service";

const mockCount = vi.fn();
const mockInsert = vi.fn(() => Promise.resolve({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => Promise.resolve({ count: mockCount(), error: null })),
          })),
        })),
        insert: mockInsert,
      })),
    }),
  ),
}));

describe("assertCanUseAi", () => {
  beforeEach(() => {
    mockCount.mockReset();
    mockInsert.mockClear();
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
  it("inserts an event with the user, plan and event type", async () => {
    await recordAiUsageEvent("user-1", "free", "chat");

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-1",
      event_type: "chat",
      plan: "free",
    });
  });

  it("supports the ask event type", async () => {
    await recordAiUsageEvent("user-1", "basic", "ask");

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-1",
      event_type: "ask",
      plan: "basic",
    });
  });
});
