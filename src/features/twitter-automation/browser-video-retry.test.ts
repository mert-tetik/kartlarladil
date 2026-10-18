import { describe, expect, it } from "vitest";
import { BROWSER_VIDEO_MAX_ATTEMPTS, BROWSER_VIDEO_PLAN_TIMEOUT_MS, BROWSER_VIDEO_RENDER_STALL_TIMEOUT_MS, browserVideoFailureCode, browserVideoRetryDelayMs, shouldRetryBrowserVideo, shouldRetryBrowserVideoFailure } from "./browser-video-retry";

describe("browser video retry policy", () => {
  it("gives script/audio preparation, active encoding, and uploads independent budgets", () => {
    expect(BROWSER_VIDEO_PLAN_TIMEOUT_MS).toBe(600_000);
    expect(BROWSER_VIDEO_RENDER_STALL_TIMEOUT_MS).toBe(300_000);
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

  it("automatically retries only transient preparation, rendering, and staging failures", () => {
    expect(shouldRetryBrowserVideoFailure("browser_video_plan_timeout")).toBe(true);
    expect(shouldRetryBrowserVideoFailure("browser_video_render_timeout")).toBe(true);
    expect(shouldRetryBrowserVideoFailure("browser_video_stage_failed")).toBe(true);
    expect(shouldRetryBrowserVideoFailure("invalid_video_scene_count")).toBe(false);
  });
});
