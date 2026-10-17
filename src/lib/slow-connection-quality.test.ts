import {
  estimateResourceTransfer,
  isSlowConnectionEstimate,
  isSlowReachabilitySample,
  MIN_RESOURCE_TRANSFER_BYTES,
  SLOW_RESOURCE_THROUGHPUT_MBPS,
  shouldRecommendOfflineMode,
} from "@/lib/slow-connection-quality";
import { DICTIONARIES } from "@/i18n/dictionaries";

describe("slow connection quality signals", () => {
  it.each(["2g", "slow-2g"])("recognizes the %s connection estimate", (effectiveType) => {
    expect(isSlowConnectionEstimate({ effectiveType })).toBe(true);
  });

  it("uses a very low estimated downlink or a combined high-latency signal", () => {
    expect(isSlowConnectionEstimate({ downlink: 0.3 })).toBe(true);
    expect(isSlowConnectionEstimate({ downlink: 0.8, rtt: 1_500 })).toBe(true);
    expect(isSlowConnectionEstimate({ downlink: 4, rtt: 1_500 })).toBe(false);
    expect(isSlowConnectionEstimate({ downlink: 2, rtt: 80, effectiveType: "4g" })).toBe(false);
  });

  it("does not prompt for one ordinary slow sample, but does after confirmation", () => {
    expect(isSlowReachabilitySample(1_900, "success")).toBe(true);
    expect(shouldRecommendOfflineMode(1_900, "success", 0)).toBe(false);
    expect(shouldRecommendOfflineMode(1_900, "success", 1)).toBe(true);
  });

  it("does not mistake a fast HTTP server error for a slow internet connection", () => {
    expect(isSlowReachabilitySample(120, "http-error")).toBe(false);
    expect(shouldRecommendOfflineMode(120, "http-error", 3)).toBe(false);
    expect(shouldRecommendOfflineMode(5_000, "http-error", 0)).toBe(false);
  });

  it("prompts immediately for a severely slow request or after repeated network failures", () => {
    expect(shouldRecommendOfflineMode(3_500, "success", 0)).toBe(true);
    expect(shouldRecommendOfflineMode(400, "network-error", 1)).toBe(true);
    expect(shouldRecommendOfflineMode(400, "network-error", 0)).toBe(false);
    expect(isSlowReachabilitySample(400, "network-error")).toBe(true);
  });

  it("estimates transfer speed from real, sufficiently large resource downloads", () => {
    const slowTransfer = estimateResourceTransfer({
      transferSizeBytes: MIN_RESOURCE_TRANSFER_BYTES,
      encodedBodySizeBytes: MIN_RESOURCE_TRANSFER_BYTES,
      responseStartMs: 100,
      responseEndMs: 1_600,
    });
    const fastTransfer = estimateResourceTransfer({
      transferSizeBytes: 256 * 1_024,
      encodedBodySizeBytes: 256 * 1_024,
      responseStartMs: 100,
      responseEndMs: 500,
    });

    expect(slowTransfer?.throughputMbps).toBeLessThanOrEqual(SLOW_RESOURCE_THROUGHPUT_MBPS);
    expect(slowTransfer?.bytesTransferred).toBe(MIN_RESOURCE_TRANSFER_BYTES);
    expect(fastTransfer?.throughputMbps).toBeGreaterThan(SLOW_RESOURCE_THROUGHPUT_MBPS);
    expect(estimateResourceTransfer({
      transferSizeBytes: MIN_RESOURCE_TRANSFER_BYTES - 1,
      responseStartMs: 100,
      responseEndMs: 10_000,
    })).toBeNull();
    expect(estimateResourceTransfer({
      transferSizeBytes: MIN_RESOURCE_TRANSFER_BYTES,
      responseStartMs: 100,
      responseEndMs: 100,
    })).toBeNull();
  });

  it("provides all four localized prompt strings for every supported locale", () => {
    const keys = [
      "network.slow.title",
      "network.slow.description",
      "network.slow.offline",
      "network.slow.continue",
    ] as const;

    for (const dictionary of Object.values(DICTIONARIES)) {
      for (const key of keys) {
        expect(dictionary[key].trim()).not.toBe("");
      }
    }
  });
});
