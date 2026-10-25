import { describe, expect, it } from "vitest";
import {
  hasUsableRemainingAccess,
  isUsableEntitlementsSnapshot,
} from "@/features/subscriptions/subscription-entitlement";

describe("hasUsableRemainingAccess", () => {
  const now = Date.parse("2026-10-25T12:00:00.000Z");

  it("allows only a valid expiry in the future", () => {
    expect(hasUsableRemainingAccess("2026-10-25T12:00:01.000Z", now)).toBe(true);
  });

  it.each([null, undefined, "", "not-a-date", "2026-10-25T12:00:00.000Z", "2026-10-25T11:59:59.000Z"])(
    "fails closed for expiry %s",
    (endsAt) => {
      expect(hasUsableRemainingAccess(endsAt, now)).toBe(false);
    },
  );

  it("rejects stale paid entitlement caches while keeping free snapshots usable", () => {
    expect(isUsableEntitlementsSnapshot(createSnapshot("pro", null), now)).toBe(false);
    expect(isUsableEntitlementsSnapshot(createSnapshot("basic", "2026-10-25T11:00:00Z"), now)).toBe(false);
    expect(isUsableEntitlementsSnapshot(createSnapshot("pro", "2026-10-25T13:00:00Z"), now)).toBe(true);
    expect(isUsableEntitlementsSnapshot(createSnapshot("free", null), now)).toBe(true);
    expect(isUsableEntitlementsSnapshot({ effectivePlan: "admin" }, now)).toBe(false);
  });
});

function createSnapshot(effectivePlan: "free" | "basic" | "pro", endsAt: string | null) {
  return {
    plan: effectivePlan,
    effectivePlan,
    status: effectivePlan === "free" ? "free" : "active",
    provider: "google_play",
    limits: {
      activeCards: effectivePlan === "free" ? 20 : null,
      learnedCards: effectivePlan === "free" ? 100 : null,
      aiDailyMessages: effectivePlan === "free" ? 10 : null,
      aiMonthlyMessages: effectivePlan === "free" ? 200 : null,
    },
    customerPortalUrl: null,
    endsAt,
  } as const;
}
