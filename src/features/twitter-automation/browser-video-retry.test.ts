import { describe, expect, it } from "vitest";
import { BROWSER_VIDEO_MAX_ATTEMPTS, browserVideoFailureCode, browserVideoRetryDelayMs, browserVideoTimeoutMs, formatBrowserVideoTimeout, shouldRetryBrowserVideo } from "./browser-video-retry";

describe("browser video retry policy", () => {
  it("starts above the healthy render range and increases each retry window", () => {
    expect(browserVideoTimeoutMs(1)).toBe(120_000);
    expect(browserVideoTimeoutMs(2)).toBe(180_000);
    expect(browserVideoTimeoutMs(3)).toBe(240_000);
    expect(formatBrowserVideoTimeout(1)).toBe("2 dk");
    expect(formatBrowserVideoTimeout(3)).toBe("4 dk");
  });

  it("allows two automatic retries before a terminal failure", () => {
    expect(BROWSER_VIDEO_MAX_ATTEMPTS).toBe(3);
    expect(shouldRetryBrowserVideo(1)).toBe(true);
    expect(shouldRetryBrowserVideo(2)).toBe(true);
    expect(shouldRetryBrowserVideo(3)).toBe(false);
  });

  it("uses short increasing delays between complete local render attempts", () => {
    expect(browserVideoRetryDelayMs(1)).toBe(1_000);
    expect(browserVideoRetryDelayMs(2)).toBe(3_000);
  });

  it("keeps safe provider error codes but falls back for raw browser errors", () => {
    expect(browserVideoFailureCode(new Error("dialogue_video_prepare_failed"))).toBe("dialogue_video_prepare_failed");
    expect(browserVideoFailureCode(new Error("raw browser exception"))).toBe("browser_video_render_failed");
    expect(browserVideoFailureCode(new Error("raw browser exception"), "browser_video_audio_prepare_failed")).toBe("browser_video_audio_prepare_failed");
    expect(browserVideoFailureCode(new Error("raw browser exception"), "browser_video_encode_failed")).toBe("browser_video_encode_failed");
    expect(browserVideoFailureCode(new Error("raw browser exception"), "browser_video_stage_failed")).toBe("browser_video_stage_failed");
  });
});
