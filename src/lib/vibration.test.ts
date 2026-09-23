import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isVibrationSupported,
  setVibrationEnabled,
  vibrate,
} from "@/lib/vibration";

function setBrowserVibration(vibrateImplementation: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "vibrate", {
    configurable: true,
    value: vibrateImplementation,
  });
}

afterEach(() => {
  window.localStorage.clear();
  delete window.FoxiesDeckNativeVibration;
  setBrowserVibration(vi.fn());
});

describe("vibration", () => {
  it("uses the Android bridge before navigator.vibrate", () => {
    const nativeVibrate = vi.fn(() => true);
    const browserVibrate = vi.fn();
    window.FoxiesDeckNativeVibration = { vibrate: nativeVibrate };
    setBrowserVibration(browserVibrate);

    vibrate("incorrect");

    expect(nativeVibrate).toHaveBeenCalledWith("[22,55,22]");
    expect(browserVibrate).not.toHaveBeenCalled();
    expect(isVibrationSupported()).toBe(true);
  });

  it("falls back to the browser vibration API outside the Android shell", () => {
    const browserVibrate = vi.fn();
    setBrowserVibration(browserVibrate);

    vibrate("tap");

    expect(browserVibrate).toHaveBeenCalledWith([22]);
    expect(isVibrationSupported()).toBe(true);
  });

  it("does not vibrate when the user disabled vibration", () => {
    const nativeVibrate = vi.fn(() => true);
    window.FoxiesDeckNativeVibration = { vibrate: nativeVibrate };
    setVibrationEnabled(false);

    vibrate("tap");

    expect(nativeVibrate).not.toHaveBeenCalled();
  });
});
