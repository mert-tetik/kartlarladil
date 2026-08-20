import { describe, expect, it } from "vitest";
import { AUTOMATION_MIN_ACCOUNT_SCHEDULE_GAP_MS, AUTOMATION_RETRY_DELAYS_MS, classifyAutomationError, formatAutomationRetryDelay, isRetryableAutomationError, nextAutomationAttemptAt } from "@/features/twitter-automation/automation-resilience";

describe("automation resilience", () => {
  it("uses the five persistent recovery intervals in order", () => {
    expect(AUTOMATION_RETRY_DELAYS_MS).toEqual([15_000, 45_000, 120_000, 300_000, 600_000]);
    const start = Date.UTC(2026, 7, 17, 12, 0, 0);
    expect(new Date(nextAutomationAttemptAt(1, start)).getTime() - start).toBe(15_000);
    expect(new Date(nextAutomationAttemptAt(5, start)).getTime() - start).toBe(600_000);
    expect(formatAutomationRetryDelay(1)).toBe("15 sn");
    expect(formatAutomationRetryDelay(2)).toBe("45 sn");
  });

  it("allows the same account to be scheduled one minute apart", () => {
    expect(AUTOMATION_MIN_ACCOUNT_SCHEDULE_GAP_MS).toBe(60_000);
  });

  it("retries transient provider, storage and browser failures but not invalid requests", () => {
    expect(classifyAutomationError("poyo_responses_provider_error")).toBe("provider");
    expect(classifyAutomationError("automation_media_store_failed")).toBe("storage");
    expect(classifyAutomationError("browser_video_encode_failed")).toBe("browser");
    expect(isRetryableAutomationError("invalid_automation_state")).toBe(false);
    expect(isRetryableAutomationError("browser_image_snapshot_failed")).toBe(true);
  });
});
