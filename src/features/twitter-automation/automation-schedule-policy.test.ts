import { describe, expect, it } from "vitest";
import { isAutomationScheduleExpired, resolveAutomationScheduleAt } from "./automation-schedule-policy";

const accountIds = [10, 20];
const fixedNow = new Date("2026-10-18T13:00:00.000Z").getTime();

describe("automation schedule retry policy", () => {
  it("identifies expired or invalid output timestamps without advancing them", () => {
    expect(isAutomationScheduleExpired("2026-10-18T14:00:00+03:00", fixedNow)).toBe(true);
    expect(isAutomationScheduleExpired("2026-10-19T12:00:00+03:00", fixedNow)).toBe(false);
    expect(isAutomationScheduleExpired("invalid", fixedNow)).toBe(true);
  });

  it("preserves a valid future slot when it clears the provider safety window", () => {
    const scheduledAt = "2026-10-19T12:00:00+03:00";

    expect(resolveAutomationScheduleAt({ scheduledAt, accountIds, reservations: [], now: fixedNow })).toBe(scheduledAt);
  });

  it("preserves valid slots more than fourteen days in the future", () => {
    const scheduledAt = "2026-11-17T12:00:00+03:00";

    expect(resolveAutomationScheduleAt({ scheduledAt, accountIds, reservations: [], now: fixedNow })).toBe(scheduledAt);
  });

  it("resolves account conflicts for slots more than fourteen days in the future", () => {
    const scheduledAt = "2026-11-17T12:00:00+03:00";
    const result = resolveAutomationScheduleAt({
      scheduledAt,
      accountIds,
      reservations: [{ accountId: 10, scheduledAt: "2026-11-17T09:00:00.000Z" }],
      now: fixedNow,
    });

    expect(new Date(result).toISOString()).toBe("2026-11-17T09:01:00.000Z");
  });

  it("rejects expired slots instead of silently rescheduling them", () => {
    const scheduledAt = "2026-10-18T14:00:00+03:00";

    expect(() => resolveAutomationScheduleAt({ scheduledAt, accountIds, reservations: [], now: fixedNow })).toThrow("automation_scheduled_at_in_past");
  });

  it("advances near-term slots that are too close to the provider cutoff", () => {
    const scheduledAt = "2026-10-18T16:10:00+03:00";
    const result = resolveAutomationScheduleAt({ scheduledAt, accountIds, reservations: [], now: fixedNow });

    expect(new Date(result).toISOString()).toBe("2026-10-19T13:10:00.000Z");
  });

  it("finds a conflict-free slot for every target account", () => {
    const scheduledAt = "2026-10-19T12:00:00+03:00";
    const result = resolveAutomationScheduleAt({
      scheduledAt,
      accountIds,
      reservations: [
        { accountId: 10, scheduledAt: "2026-10-19T09:00:00.000Z" },
        { accountId: 20, scheduledAt: "2026-10-19T09:01:00.000Z" },
      ],
      now: fixedNow,
    });

    expect(new Date(result).toISOString()).toBe("2026-10-19T09:02:00.000Z");
  });

  it("rejects malformed persisted timestamps instead of silently publishing at an unintended time", () => {
    expect(() => resolveAutomationScheduleAt({ scheduledAt: "not-a-date", accountIds, reservations: [], now: fixedNow })).toThrow("automation_schedule_date_invalid");
  });
});
