import { getOnboardingLanguageDefaults } from "@/features/auth/onboarding-defaults";

describe("getOnboardingLanguageDefaults", () => {
  it("prefers the supported language mapped from the request country", () => {
    expect(getOnboardingLanguageDefaults("TR", "en")).toEqual({
      preferredUiLocale: "tr",
      preferredLanguageCode: "en",
    });
    expect(getOnboardingLanguageDefaults("US", "ja")).toEqual({
      preferredUiLocale: "en",
      preferredLanguageCode: "es",
    });
  });

  it("falls back to the device language when the country is unavailable or unsupported", () => {
    expect(getOnboardingLanguageDefaults(null, "ja-JP")).toEqual({
      preferredUiLocale: "ja",
      preferredLanguageCode: "en",
    });
    expect(getOnboardingLanguageDefaults("XX", "en-US")).toEqual({
      preferredUiLocale: "en",
      preferredLanguageCode: "es",
    });
  });
});
