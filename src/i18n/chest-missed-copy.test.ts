import { describe, expect, it } from "vitest";
import { DICTIONARIES, translate } from "@/i18n/dictionaries";
import type { LocaleCode } from "@/types/domain";

const locales = Object.keys(DICTIONARIES) as LocaleCode[];

describe("missed chest card shortage translations", () => {
  it.each(locales)("provides localized copy with interpolated counts for %s", (locale) => {
    const reason = DICTIONARIES[locale]["chest.missedNotEnoughCards"];
    const instruction = translate(locale, "chest.missedNeedMoreCards", {
      requiredCount: 10,
      remainingCount: 3,
    });

    expect(reason.trim().length).toBeGreaterThan(0);
    if (locale !== "en") {
      expect(reason).not.toBe(DICTIONARIES.en["chest.missedNotEnoughCards"]);
      expect(instruction).not.toBe(DICTIONARIES.en["chest.missedNeedMoreCards"]);
    }
    expect(instruction).toContain("10");
    expect(instruction).toContain("3");
    expect(instruction).not.toMatch(/\{\w+\}/);
  });
});
