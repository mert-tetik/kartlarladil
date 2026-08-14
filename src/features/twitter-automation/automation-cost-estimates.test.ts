import { describe, expect, it } from "vitest";
import { estimateAutomationGroupCost, type AutomationCostRow } from "@/features/twitter-automation/automation-cost-estimates";
import { describeExpectedOutputSourceMix, estimateAutomationOutputDistribution } from "@/features/twitter-automation/automation-output-distribution";

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

  it("prices AI Example Sentences music videos as AI image source generation", () => {
    const estimate = estimateAutomationGroupCost([{
      contentType: "video",
      generator: "music-ai-example-sentences",
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

    expect(estimate.totalUsd).toBeCloseTo(0.01315 * 6 / 15, 8);
  });

  it("uses only the selected sources for the single Random generator", () => {
    const estimate = estimateAutomationGroupCost([{
      contentType: "image",
      generator: "random",
      randomIncludes: { image: ["self"] },
    }]);

    expect(estimate.totalUsd).toBe(0);
  });

  it("uses the same per-mode probabilities as scheduled random outputs", () => {
    const row: AutomationCostRow = {
      contentType: "image",
      generator: "random",
      randomIncludes: { image: ["self", "ai"] },
      quantity: 5,
    };

    const distribution = estimateAutomationOutputDistribution([row]);
    const estimate = estimateAutomationGroupCost([row]);

    expect(distribution.totalOutputs).toBeCloseTo(5, 8);
    expect(distribution.expectedBySource.SELF).toBeCloseTo(3, 8);
    expect(distribution.expectedBySource.AI).toBeCloseTo(2, 8);
    expect(describeExpectedOutputSourceMix(distribution)).toBe("AI 2 · SELF 3");
    expect(estimate.totalUsd).toBeCloseTo(2 * 0.01315, 8);
  });

  it("splits multi-content rows before calculating individual mode probabilities", () => {
    const distribution = estimateAutomationOutputDistribution([{
      contentType: "random",
      generator: "random",
      contentTypes: ["text", "image"],
      generators: { text: "fun-post", image: "random" },
      randomIncludes: { image: ["self"] },
      quantity: 6,
    }]);

    expect(distribution.expectedByContentType.text).toBeCloseTo(3, 8);
    expect(distribution.expectedByContentType.image).toBeCloseTo(3, 8);
    expect(distribution.expectedBySource.AI).toBeCloseTo(3, 8);
    expect(distribution.expectedBySource.SELF).toBeCloseTo(3, 8);
  });

  it("multiplies a row's estimate by its selected output quantity", () => {
    const single = estimateAutomationGroupCost([{
      contentType: "text",
      generator: "fun-post",
    }]);
    const multiple = estimateAutomationGroupCost([{
      contentType: "text",
      generator: "fun-post",
      quantity: 5,
    }]);

    expect(multiple.totalUsd).toBeCloseTo(single.totalUsd * 5, 8);
  });
});
