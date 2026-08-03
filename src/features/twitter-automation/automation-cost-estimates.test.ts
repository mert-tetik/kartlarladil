import { describe, expect, it } from "vitest";
import { estimateAutomationGroupCost } from "@/features/twitter-automation/automation-cost-estimates";

describe("automation cost estimates", () => {
  it("uses PoYo Luna pricing for normal text posts", () => {
    const estimate = estimateAutomationGroupCost([{
      contentType: "text",
      generator: "fun-post",
    }]);

    expect(estimate.poyoUsd).toBeCloseTo(0.000378, 8);
    expect(estimate.totalUsd).toBeCloseTo(0.000378, 8);
    expect(estimate.oneOffTry).toBeCloseTo(0.01796445, 8);
  });

  it("uses PoYo Terra pricing alongside the low 1K image render", () => {
    const estimate = estimateAutomationGroupCost([{
      contentType: "image",
      generator: "ai-word-of-the-day",
    }]);

    expect(estimate.poyoUsd).toBeCloseTo(0.01315, 8);
    expect(estimate.totalUsd).toBeCloseTo(0.01315, 8);
    expect(estimate.monthlyTry).toBeCloseTo(estimate.oneOffTry * 30, 8);
  });

  it("applies the same image cost to AI music-video source images", () => {
    const estimate = estimateAutomationGroupCost([{
      contentType: "video",
      generator: "music-ai-mini-quiz",
    }]);

    expect(estimate.totalUsd).toBeCloseTo(0.01315, 8);
  });

  it("includes the PoYo image, TTS, and avatar costs for avatar videos", () => {
    const estimate = estimateAutomationGroupCost([{
      contentType: "video",
      generator: "ai-word-of-the-day-video",
    }]);

    expect(estimate.poyoUsd).toBeCloseTo(0.44289, 8);
    expect(estimate.totalUsd).toBeCloseTo(0.44289, 8);
  });

  it("prices the Canvas confused-words video from its three-phase Terra plan and 24 TTS segments", () => {
    const estimate = estimateAutomationGroupCost([{
      contentType: "video",
      generator: "confused-words-video",
    }]);

    expect(estimate.totalUsd).toBeCloseTo(0.02578, 8);
    expect(estimate.oneOffTry).toBeCloseTo(1.2251945, 8);
  });

  it("keeps random image modes as their weighted expected cost", () => {
    const estimate = estimateAutomationGroupCost([{
      contentType: "image",
      generator: "random-image",
    }]);

    expect(estimate.totalUsd).toBeCloseTo(0.01315 * 5 / 7, 8);
  });
});
