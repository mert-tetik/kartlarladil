import { buildInactivityNotification, getDueInactivityStage, normalizePushLocale } from "@/features/push/push-server";

describe("push-server helpers", () => {
  const now = new Date("2026-07-03T12:00:00.000Z");

  it("selects stages at 2, 4, and 8 days", () => {
    expect(getDueInactivityStage("2026-07-01T11:59:00.000Z", 0, now)).toBe(1);
    expect(getDueInactivityStage("2026-06-29T11:59:00.000Z", 1, now)).toBe(2);
    expect(getDueInactivityStage("2026-06-25T11:59:00.000Z", 2, now)).toBe(3);
  });

  it("does not repeat a stage that was already sent", () => {
    expect(getDueInactivityStage("2026-06-29T11:59:00.000Z", 2, now)).toBeNull();
    expect(getDueInactivityStage("2026-06-25T11:59:00.000Z", 3, now)).toBeNull();
  });

  it("falls back to English copy when the locale does not override push strings", () => {
    const locale = normalizePushLocale("de");
    const copy = buildInactivityNotification(locale, 1);

    expect(copy.title).toBe("Your cards are waiting");
  });

  it("normalizes unknown locales to English", () => {
    expect(normalizePushLocale("xx")).toBe("en");
  });
});
