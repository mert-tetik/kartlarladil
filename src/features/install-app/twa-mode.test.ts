import { afterEach, describe, expect, it } from "vitest";
import { getTwaMode, isIosMobileTestMode, isMobileTestMode } from "./twa-mode";

const originalUrl = window.location.href;

afterEach(() => {
  window.history.replaceState({}, "", originalUrl);
  window.sessionStorage.clear();
  delete (window as Window & { FoxiesDeckNativeBilling?: unknown }).FoxiesDeckNativeBilling;
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

describe("installed app detection", () => {
  it("detects the native Google Play Billing bridge", () => {
    window.sessionStorage.setItem("foxiesdeck:twa-mode", "false");
    Object.defineProperty(window, "FoxiesDeckNativeBilling", {
      configurable: true,
      value: {
        getDetails: () => "[]",
        listPurchases: () => "[]",
        purchase: () => "{}",
      },
    });

    expect(getTwaMode()).toBe(true);
  });
});
