export const AUTOMATION_SCHEDULE_BATCH_SIZE = 20;
export const AUTOMATION_SCHEDULE_BATCH_DELAY_MS = 90_000;
export const AUTOMATION_SCHEDULE_STATUS_CHECK_INTERVAL_MS = 5 * 60_000;
export const AUTOMATION_SCHEDULE_MAX_DURATION_MS = 60 * 60_000;

export function createAutomationScheduleBatches(outputIds: readonly string[]) {
  const uniqueIds = [...new Set(outputIds)];
  const batches: string[][] = [];

  for (let index = 0; index < uniqueIds.length; index += AUTOMATION_SCHEDULE_BATCH_SIZE) {
    batches.push(uniqueIds.slice(index, index + AUTOMATION_SCHEDULE_BATCH_SIZE));
  }

  return batches;
}
