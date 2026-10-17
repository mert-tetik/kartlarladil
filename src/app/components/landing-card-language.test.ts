import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  readLandingCardLanguage,
  subscribeLandingCardLanguage,
  subscribeLandingCardLanguageSync,
  writeLandingCardLanguage,
} from "@/app/components/landing-card-language";

describe("landing card language storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("notifies subscribers when the landing card language changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLandingCardLanguage(listener);

    writeLandingCardLanguage("en");

    expect(readLandingCardLanguage()).toBe("en");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    writeLandingCardLanguage("de");

    expect(readLandingCardLanguage()).toBe("de");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("can write without notifying subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLandingCardLanguage(listener);

    writeLandingCardLanguage("ko", { notify: false });

    expect(readLandingCardLanguage()).toBe("ko");
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it("notifies the offline sync when its persisted value changes without rerendering the language picker", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLandingCardLanguageSync(listener);

    writeLandingCardLanguage("de", { notify: false });

    expect(readLandingCardLanguage()).toBe("de");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
