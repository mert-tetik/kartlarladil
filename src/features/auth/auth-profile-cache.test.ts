import { afterEach, describe, expect, it } from "vitest";
import { readCachedAuthProfile, writeCachedAuthProfile } from "@/features/auth/auth-profile-cache";
import type { AuthProfile } from "@/features/auth/auth-types";

const profile: AuthProfile = {
  displayName: "Foxy",
  preferredLanguageCode: "en",
  preferredUiLocale: "tr",
  preferredTier: "A1",
  onboardingCompleted: true,
  aiPracticePoints: 25,
  chestPoints: 10,
  theme: "violet",
};

describe("auth profile cache", () => {
  afterEach(() => window.localStorage.clear());

  it("round-trips a normalized profile under the matching user ID", () => {
    writeCachedAuthProfile("user/one", profile);

    expect(readCachedAuthProfile("user/one")).toEqual(profile);
    expect(readCachedAuthProfile("user-two")).toBeNull();
    expect(window.localStorage.getItem("foxiesdeck:auth-profile:v1:user%2Fone")).not.toContain("token");
  });

  it("rejects invalid or version-mismatched cached data", () => {
    window.localStorage.setItem("foxiesdeck:auth-profile:v1:user-one", JSON.stringify({
      version: 1,
      userId: "user-one",
      profile: { ...profile, aiPracticePoints: -1 },
    }));
    expect(readCachedAuthProfile("user-one")).toBeNull();

    window.localStorage.setItem("foxiesdeck:auth-profile:v1:user-two", JSON.stringify({
      version: 2,
      userId: "user-two",
      profile,
    }));
    expect(readCachedAuthProfile("user-two")).toBeNull();
  });
});
