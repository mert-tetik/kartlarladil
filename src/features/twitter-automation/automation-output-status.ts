export type AutomationOutputStatus =
  | "queued"
  | "processing"
  | "generating_video"
  | "awaiting_browser_image"
  | "awaiting_browser_video"
  | "ready_to_schedule"
  | "scheduled"
  | "failed"
  | "skipped";

type AutomationOutputStatusLike = {
  status: string;
};

/**
 * Keep the progress counter, status chips, and review cards on one persisted
 * status contract. A failed output has finished an attempt, but it is never a
 * successful generation and must not advance the green progress bar.
 */
export function isSuccessfulAutomationOutput(output: AutomationOutputStatusLike) {
  return output.status === "ready_to_schedule" || output.status === "scheduled";
}

export function isFailedAutomationOutput(output: AutomationOutputStatusLike) {
  return output.status === "failed";
}

export function isSkippedAutomationOutput(output: AutomationOutputStatusLike) {
  return output.status === "skipped";
}

export function isWaitingAutomationOutput(output: AutomationOutputStatusLike) {
  return !isSuccessfulAutomationOutput(output) && !isFailedAutomationOutput(output) && !isSkippedAutomationOutput(output);
}
