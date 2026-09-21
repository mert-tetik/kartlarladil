import {
  buildTransliterationHint,
  containsRequiredTargetScript,
  normalizeLatinTransliteration,
  normalizeTransliterationMatchKey,
  requiresNativeWritingSystem,
} from "@/features/cards/create-card-language";

describe("custom card target-language writing systems", () => {
  it.each([
    ["ru", "слушать"],
    ["ar", "مرحبا"],
    ["ja", "ありがとう"],
    ["ko", "안녕"],
    ["zh-CN", "你好"],
  ] as const)("recognizes the native script for %s", (language, term) => {
    expect(requiresNativeWritingSystem(language)).toBe(true);
    expect(containsRequiredTargetScript(term, language)).toBe(true);
    expect(containsRequiredTargetScript("slushat", language)).toBe(false);
  });

  it("does not require a special script for Latin target languages", () => {
    expect(requiresNativeWritingSystem("en")).toBe(false);
    expect(containsRequiredTargetScript("listen", "en")).toBe(true);
  });

  it.each([
    ["sluşat", "slushat"],
    ["slushat'", "slushat"],
    ["slušat", "slushat"],
    ["  marhaban! ", "marhaban"],
    ["ni—hao", "ni hao"],
    ["smørrebrød", "smorrebrod"],
  ])("normalizes transliteration variant %s", (input, expected) => {
    expect(normalizeLatinTransliteration(input)).toBe(expected);
  });

  it("adds a normalized phonetic hint only for a native-script target", () => {
    expect(buildTransliterationHint("sluşat", "ru")).toContain('"slushat"');
    expect(buildTransliterationHint("слушать", "ru")).toBe("");
    expect(buildTransliterationHint("listen", "en")).toBe("");
  });

  it("matches common pronunciation spacing and w/v variants", () => {
    expect(normalizeTransliterationMatchKey("konnichiwa")).toBe("konnichiva");
    expect(normalizeTransliterationMatchKey("an nyeong ha se yo")).toBe("annyeonghaseyo");
    expect(normalizeTransliterationMatchKey("ni-hao")).toBe("nihao");
    expect(normalizeTransliterationMatchKey("ni hao")).toBe("nihao");
  });
});
