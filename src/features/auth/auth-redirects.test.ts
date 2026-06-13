import { getSafeNextPath } from "@/features/auth/auth-redirects";

describe("auth redirects", () => {
  it("keeps internal paths with query strings", () => {
    expect(getSafeNextPath("/card-draw?x=1")).toBe("/card-draw?x=1");
  });

  it("normalizes legacy Turkish route names to English routes", () => {
    expect(getSafeNextPath("/kart-cek?x=1#deck")).toBe("/card-draw?x=1#deck");
    expect(getSafeNextPath("/profil")).toBe("/profile");
  });

  it("rejects external URLs", () => {
    expect(getSafeNextPath("https://example.com", "/my-cards")).toBe("/my-cards");
  });

  it("rejects protocol-relative URLs", () => {
    expect(getSafeNextPath("//example.com", "/my-cards")).toBe("/my-cards");
  });
});
