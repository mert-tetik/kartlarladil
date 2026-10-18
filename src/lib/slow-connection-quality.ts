export interface NetworkConnectionEstimate {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

export type ReachabilityProbeOutcome = "success" | "http-error" | "network-error";

export interface ResourceTransferSample {
  transferSizeBytes: number;
  encodedBodySizeBytes?: number;
  responseStartMs: number;
  responseEndMs: number;
}

export interface ResourceTransferEstimate {
  bytesTransferred: number;
  durationMs: number;
  throughputMbps: number;
}

export const SLOW_CONNECTION_LATENCY_MS = 8_000;
export const VERY_SLOW_CONNECTION_LATENCY_MS = 12_000;
export const MIN_RESOURCE_TRANSFER_BYTES = 64 * 1_024;
export const SLOW_RESOURCE_THROUGHPUT_MBPS = 0.05;
export const CUSTOM_CARD_GENERATION_STALLED_EVENT = "foxiesdeck:custom-card-generation-stalled";

export function isSlowConnectionEstimate(estimate?: NetworkConnectionEstimate | null) {
  if (!estimate) return false;

  const effectiveType = estimate.effectiveType?.toLowerCase();
  if (effectiveType === "slow-2g") return true;

  const hasDownlink = typeof estimate.downlink === "number" && Number.isFinite(estimate.downlink);
  const hasRtt = typeof estimate.rtt === "number" && Number.isFinite(estimate.rtt);

  if (hasDownlink && estimate.downlink! <= 0.08) return true;
  return hasDownlink && hasRtt && estimate.downlink! <= 0.2 && estimate.rtt! >= 2_500;
}

export function isSlowReachabilitySample(
  latencyMs: number,
  outcome: ReachabilityProbeOutcome,
) {
  if (outcome === "http-error") return false;
  return outcome === "network-error" || latencyMs >= SLOW_CONNECTION_LATENCY_MS;
}

export function shouldRecommendOfflineMode(
  latencyMs: number,
  outcome: ReachabilityProbeOutcome,
  consecutiveSlowSamples: number,
) {
  if (outcome === "http-error") return false;
  if (latencyMs >= VERY_SLOW_CONNECTION_LATENCY_MS) return true;
  return isSlowReachabilitySample(latencyMs, outcome) && consecutiveSlowSamples >= 1;
}

export function estimateResourceTransfer(sample: ResourceTransferSample): ResourceTransferEstimate | null {
  const byteCount = sample.encodedBodySizeBytes && sample.encodedBodySizeBytes > 0
    ? sample.encodedBodySizeBytes
    : sample.transferSizeBytes;
  const durationMs = sample.responseEndMs - sample.responseStartMs;

  if (
    !Number.isFinite(byteCount)
    || byteCount < MIN_RESOURCE_TRANSFER_BYTES
    || !Number.isFinite(durationMs)
    || durationMs <= 0
  ) {
    return null;
  }

  return {
    bytesTransferred: byteCount,
    durationMs,
    throughputMbps: (byteCount * 8) / (durationMs * 1_000),
  };
}
