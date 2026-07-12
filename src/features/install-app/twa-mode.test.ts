import { afterEach, describe, expect, it } from "vitest";
import { isIosMobileTestMode, isMobileTestMode } from "./twa-mode";

const originalUrl = window.location.href;

afterEach(() => {
  window.history.replaceState({}, "", originalUrl);
});

describe("mobile test URL parameters", () => {
  it("forces the iPhone app-choice test mode with mobile-test=ios", () => {
    window.history.replaceState({}, "", "/?mobile-test=ios");

    expect(isMobileTestMode()).toBe(true);
    expect(isIosMobileTestMode()).toBe(true);
  });

  it("keeps the generic mobile test mode separate from the iPhone screen", () => {
    window.history.replaceState({}, "", "/?mobile-test");

    expect(isMobileTestMode()).toBe(true);
    expect(isIosMobileTestMode()).toBe(false);
  });
});
