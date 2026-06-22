import { shouldBlockLocaleChange } from "@/components/locale-switcher";

describe("shouldBlockLocaleChange", () => {
  it("blocks changing the site language on the learn page", () => {
    expect(shouldBlockLocaleChange("/learn", "en", "de")).toBe(true);
  });

  it("allows reselecting the current language on the learn page", () => {
    expect(shouldBlockLocaleChange("/learn", "en", "en")).toBe(false);
  });

  it("allows changing the site language outside the learn page", () => {
    expect(shouldBlockLocaleChange("/card-draw", "en", "de")).toBe(false);
    expect(shouldBlockLocaleChange("/learn/results", "en", "de")).toBe(false);
  });
});
