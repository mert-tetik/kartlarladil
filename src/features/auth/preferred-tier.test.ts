import { normalizePreferredTier } from "@/features/auth/preferred-tier";

describe("preferred tier helpers", () => {
  it("preserves all as a valid preferred tier", () => {
    expect(normalizePreferredTier("all")).toBe("all");
  });

  it("returns null for invalid preferred tier values", () => {
    expect(normalizePreferredTier("C2")).toBeNull();
  });
});
