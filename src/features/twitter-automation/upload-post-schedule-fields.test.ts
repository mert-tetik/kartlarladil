import { describe, expect, it } from "vitest";
import { getUploadPostScheduleFields } from "./upload-post-schedule-fields";

describe("Upload-Post schedule serialization", () => {
  it("preserves the exact scheduled instant as UTC without a second timezone conversion", () => {
    const fields = new FormData();
    for (const [name, value] of getUploadPostScheduleFields("2026-10-19T10:30:00+03:00", new Date("2026-10-18T13:00:00.000Z").getTime())) {
      fields.append(name, value);
    }

    expect(fields.get("scheduled_date")).toBe("2026-10-19T07:30:00.000Z");
    expect(fields.has("timezone")).toBe(false);
  });

  it("omits scheduling fields for immediate posts", () => {
    expect(getUploadPostScheduleFields()).toEqual([]);
  });

  it.each(["not-a-date", "2026-10-18T12:59:59.999Z"]) ("rejects invalid or already-past slots: %s", (scheduledFor) => {
    expect(() => getUploadPostScheduleFields(scheduledFor, new Date("2026-10-18T13:00:00.000Z").getTime())).toThrow("invalid_scheduled_date");
  });

  it("rejects dates beyond Upload-Post's 365-day scheduling window", () => {
    const now = new Date("2026-10-18T13:00:00.000Z").getTime();
    const tooFarAhead = new Date(now + 366 * 24 * 60 * 60 * 1_000).toISOString();

    expect(() => getUploadPostScheduleFields(tooFarAhead, now)).toThrow("invalid_scheduled_date");
  });
});
