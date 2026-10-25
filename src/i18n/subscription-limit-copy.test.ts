import { DICTIONARIES } from "@/i18n/dictionaries";
import type { LocaleCode } from "@/types/domain";

describe("localized subscription card-limit copy", () => {
  for (const locale of Object.keys(DICTIONARIES) as LocaleCode[]) {
    it(`${locale} states the enforced card limits without corrupted text`, () => {
      const dictionary = DICTIONARIES[locale];
      const activeLimit = dictionary["limit.activeCardLimitDescription"];
      const learnedLimit = dictionary["limit.learnedCardLimitDescription"];

      expect(activeLimit).toContain("20");
      expect(learnedLimit).toContain("100");
      expect(activeLimit).not.toMatch(/\?{2,}/);
      expect(learnedLimit).not.toMatch(/\?{2,}/);
    });
  }
});
