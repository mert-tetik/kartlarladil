import { LOCALE_CODES } from "@/data/languages";
import localizedStatusCopy from "./native-loading-status-copy.json";
import { getNativeLoadingStatuses } from "./native-loading-copy";

describe("native loading status copy", () => {
  it("has twenty unique waiting messages in every supported locale", () => {
    for (const locale of LOCALE_CODES) {
      const messages = localizedStatusCopy[locale];

      expect(messages).toHaveLength(20);
      expect(new Set(messages).size).toBe(20);
      expect(messages.every((message) => message.trim().length > 0)).toBe(true);
    }
  });

  it("selects eight distinct localized waiting messages for every supported locale", () => {
    for (const locale of LOCALE_CODES) {
      const statuses = getNativeLoadingStatuses(locale);

      expect(statuses).toHaveLength(8);
      expect(new Set(statuses).size).toBe(8);
      expect(statuses.every((status) => status.length > 0)).toBe(true);
    }
  });

  it("can produce different launch copy selections", () => {
    const firstLaunch = getNativeLoadingStatuses("en", () => 0);
    const secondLaunch = getNativeLoadingStatuses("en", () => 0.999999);

    expect(secondLaunch).not.toEqual(firstLaunch);
  });
});
