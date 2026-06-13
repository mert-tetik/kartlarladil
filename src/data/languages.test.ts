
import { LANGUAGES, matchSupportedLocale } from "@/data/languages";
import { DEFAULT_LOCALE } from "@/i18n/config";

describe("language metadata", () => {
  it("uses English as the unsupported-locale fallback", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(matchSupportedLocale("en-US")).toBe("en");
    expect(matchSupportedLocale("zh-Hans-CN")).toBe("zh-CN");
    expect(matchSupportedLocale("xx-YY")).toBeNull();
  });

  it("keeps Turkish available without pinning it first", () => {
    expect(LANGUAGES[0]?.code).toBe("en");
    expect(LANGUAGES[0]?.code).not.toBe("tr");
    expect(LANGUAGES.some((language) => language.code === "tr")).toBe(true);
  });
});
