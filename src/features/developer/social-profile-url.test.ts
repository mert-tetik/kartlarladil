import { describe, expect, it } from "vitest";
import { getSocialProfileUrl } from "./social-profile-url";

describe("social profile URLs", () => {
  it("uses the platform-specific handle path", () => {
    expect(getSocialProfileUrl("Instagram", "@foxiesdeck")).toBe("https://www.instagram.com/foxiesdeck/");
    expect(getSocialProfileUrl("TikTok", "foxiesdeck")).toBe("https://www.tiktok.com/@foxiesdeck");
    expect(getSocialProfileUrl("YouTube", "@FoxiesDeck")).toBe("https://www.youtube.com/@FoxiesDeck");
    expect(getSocialProfileUrl("X", "foxiesdeck")).toBe("https://x.com/foxiesdeck");
    expect(getSocialProfileUrl("Threads", "foxiesdeck")).toBe("https://www.threads.com/@foxiesdeck");
  });

  it("handles channel IDs, Facebook IDs, and provider URLs", () => {
    expect(getSocialProfileUrl("youtube", "UC12345678901234567890")).toBe("https://www.youtube.com/channel/UC12345678901234567890");
    expect(getSocialProfileUrl("facebook", "123456789")).toBe("https://www.facebook.com/profile.php?id=123456789");
    expect(getSocialProfileUrl("Pinterest", "https://www.pinterest.com/foxiesdeck/"))
      .toBe("https://www.pinterest.com/foxiesdeck/");
  });

  it("does not invent links for unsupported platforms or display names", () => {
    expect(getSocialProfileUrl("Google Business", "FoxiesDeck Türkiye")).toBeNull();
    expect(getSocialProfileUrl("Instagram", "FoxiesDeck Türkiye")).toBeNull();
    expect(getSocialProfileUrl("Instagram", "https://evil.example/foxiesdeck")).toBeNull();
  });
});
