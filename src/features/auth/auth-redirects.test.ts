import { describe, expect, it } from "vitest";
import { getSafeNextPath } from "@/features/auth/auth-redirects";

describe("auth redirects", () => {
  it("keeps internal paths with query strings", () => {
    expect(getSafeNextPath("/kesfet?x=1")).toBe("/kesfet?x=1");
  });

  it("rejects external URLs", () => {
    expect(getSafeNextPath("https://example.com", "/kartlarim")).toBe("/kartlarim");
  });

  it("rejects protocol-relative URLs", () => {
    expect(getSafeNextPath("//example.com", "/kartlarim")).toBe("/kartlarim");
  });
});
