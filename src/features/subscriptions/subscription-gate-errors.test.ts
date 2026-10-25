import { describe, expect, it, vi } from "vitest";
import { throwSubscriptionGateUnavailable } from "@/features/subscriptions/subscription-gate-errors";

describe("subscription gate error logging", () => {
  it("logs safe codes and status without logging provider error messages", () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => throwSubscriptionGateUnavailable("ai_usage", {
      code: "PGRST001",
      status: 503,
      message: "failed URL contains bearer secret-token-value",
    })).toThrow("subscription_service_unavailable");

    expect(logSpy).toHaveBeenCalledWith(
      "Subscription gate backend check failed.",
      { operation: "ai_usage", code: "PGRST001", status: 503 },
    );
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain("secret-token-value");
    logSpy.mockRestore();
  });
});
