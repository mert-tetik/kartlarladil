import { describe, expect, it } from "vitest";
import {
  AUTOMATION_SCHEDULED_AT_IN_PAST_CODE,
  getAutomationScheduleFailureReason,
  isScheduleErrorEligible,
  SCHEDULE_RETRY_ERROR_OR_FILTER,
} from "./automation-schedule-errors";

describe("automation schedule errors", () => {
  it("keeps never-attempted NULL errors eligible while excluding expired schedule slots", () => {
    expect(isScheduleErrorEligible(null)).toBe(true);
    expect(isScheduleErrorEligible(undefined)).toBe(true);
    expect(isScheduleErrorEligible("upload_post_rate_limited")).toBe(true);
    expect(isScheduleErrorEligible(AUTOMATION_SCHEDULED_AT_IN_PAST_CODE)).toBe(false);
    expect(SCHEDULE_RETRY_ERROR_OR_FILTER).toBe(
      "schedule_error_code.is.null,schedule_error_code.neq.automation_scheduled_at_in_past",
    );
  });

  it("shows provider detail instead of hiding it behind a generic schedule message", () => {
    expect(getAutomationScheduleFailureReason("upload_post_rejected", "HTTP 400: Scheduled time is unavailable."))
      .toBe("HTTP 400: Scheduled time is unavailable.");
  });

  it("translates internal failure codes into readable reasons", () => {
    expect(getAutomationScheduleFailureReason("upload_post_rate_limited", "upload_post_rate_limited"))
      .toBe("Upload-Post istek sınırına takıldı. Biraz bekleyip tekrar dene.");
  });
});
