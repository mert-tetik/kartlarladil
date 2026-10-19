import { describe, expect, it } from "vitest";
import { AUTOMATION_SCHEDULE_BATCH_DELAY_MS, AUTOMATION_SCHEDULE_BATCH_SIZE, AUTOMATION_SCHEDULE_MAX_DURATION_MS, AUTOMATION_SCHEDULE_STATUS_CHECK_INTERVAL_MS, createAutomationScheduleBatches } from "./automation-schedule-batches";

describe("automation schedule batches", () => {
  it("groups posts into batches of at most 20", () => {
    const batches = createAutomationScheduleBatches(Array.from({ length: 51 }, (_, index) => `output-${index + 1}`));

    expect(batches.map((batch) => batch.length)).toEqual([20, 20, 11]);
    expect(batches.flat()).toHaveLength(51);
    expect(Math.max(...batches.map((batch) => batch.length))).toBe(AUTOMATION_SCHEDULE_BATCH_SIZE);
  });

  it("removes duplicate output ids before batching", () => {
    expect(createAutomationScheduleBatches(["one", "one", "two"])).toEqual([["one", "two"]]);
  });

  it("uses a 90-second pause between batches", () => {
    expect(AUTOMATION_SCHEDULE_BATCH_DELAY_MS).toBe(90_000);
  });

  it("checks provider status every five minutes and stops the automatic flow after one hour", () => {
    expect(AUTOMATION_SCHEDULE_STATUS_CHECK_INTERVAL_MS).toBe(5 * 60_000);
    expect(AUTOMATION_SCHEDULE_MAX_DURATION_MS).toBe(60 * 60_000);
  });
});
