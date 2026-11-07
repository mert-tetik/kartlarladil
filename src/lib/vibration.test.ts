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
    expect(nativeVibrate).toHaveBeenCalledWith("[64,42,78]");
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

  it("uses a short, subtle pulse when a reward reaches its display", () => {
    const browserVibrate = vi.fn();
    setBrowserVibration(browserVibrate);
    vibrate("reward-arrival");
    expect(browserVibrate).toHaveBeenCalledWith([18]);
  });

  it("uses a solid pulse when advancing through the tutorial", () => {
    const browserVibrate = vi.fn();
    setBrowserVibration(browserVibrate);
    vibrate("tutorial-next");
    expect(browserVibrate).toHaveBeenCalledWith([72]);
  });

  it("uses a strong two-hit pattern for quiz reward box flashes", () => {
    const browserVibrate = vi.fn();
    setBrowserVibration(browserVibrate);
    vibrate("quiz-reward-pulse");
    expect(browserVibrate).toHaveBeenCalledWith([110, 35, 180]);
  });

  it("uses a heavy double thud when collecting the bonus-question reward", () => {
    const browserVibrate = vi.fn();
    setBrowserVibration(browserVibrate);
    vibrate("bonus-reward-loot");
    expect(browserVibrate).toHaveBeenCalledWith([130, 35, 220]);
  });

  it("does not vibrate when the user disabled vibration", () => {
    const nativeVibrate = vi.fn(() => true);
    window.FoxiesDeckNativeVibration = { vibrate: nativeVibrate };
    setVibrationEnabled(false);
    vibrate("tap");
    expect(nativeVibrate).not.toHaveBeenCalled();
  });
});
