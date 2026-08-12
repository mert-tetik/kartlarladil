import { describe, expect, it } from "vitest";
import { estimateRemainingGenerationSeconds, formatEstimatedDuration } from "@/features/twitter-automation/automation-generation-estimates";

describe("automation generation estimates", () => {
  it("uses generator-specific durations and reduces the active item's elapsed time", () => {
    expect(estimateRemainingGenerationSeconds({
      activeOutputId: "image",
      activeElapsedSeconds: 10,
      outputs: [
        { id: "image", contentType: "image", generator: "ai-mini-quiz", status: "processing" },
        { id: "text", contentType: "text", generator: "fun-post", status: "queued" },
      ],
    })).toBe(38);
  });

  it("excludes completed, failed, and user-confirmation video work", () => {
    expect(estimateRemainingGenerationSeconds({
      activeOutputId: null,
      outputs: [
        { id: "ready", contentType: "text", generator: "fun-post", status: "ready_to_schedule" },
        { id: "failed", contentType: "image", generator: "ai-mini-quiz", status: "failed" },
        { id: "audio", contentType: "video", generator: "music-word-of-the-day", status: "awaiting_browser_video" },
      ],
    })).toBe(0);
  });

  it("formats a concise Turkish duration", () => {
    expect(formatEstimatedDuration(63.1)).toBe("1 dk 4 sn");
  });

  it("does not increase an estimate when the display clock is slightly behind the start clock", () => {
    expect(estimateRemainingGenerationSeconds({
      activeOutputId: "text",
      activeElapsedSeconds: -0.5,
      outputs: [{ id: "text", contentType: "text", generator: "fun-post", status: "processing" }],
    })).toBe(8);
  });
});
