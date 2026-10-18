import { AUTOMATION_MIN_ACCOUNT_SCHEDULE_GAP_MS } from "@/features/twitter-automation/automation-resilience";

const DAY_MS = 24 * 60 * 60 * 1_000;
export const AUTOMATION_SCHEDULE_MIN_LEAD_MS = 15 * 60 * 1_000;
const MAX_SCHEDULE_SEARCH_MS = 14 * DAY_MS;

export type AutomationScheduleReservation = {
  accountId: number;
  scheduledAt: string;
};

export function isAutomationScheduleExpired(scheduledAt: string, now = Date.now()) {
  const timestamp = new Date(scheduledAt).getTime();
  return !Number.isFinite(timestamp) || timestamp <= now;
}

/**
 * Preserve the selected slot when it is still in the future. Truly expired
 * timestamps are errors; future slots inside the provider safety window can
 * move forward by Istanbul calendar days before account conflicts are checked.
 */
export function resolveAutomationScheduleAt({
  scheduledAt,
  accountIds,
  reservations,
  now = Date.now(),
}: {
  scheduledAt: string;
  accountIds: readonly number[];
  reservations: readonly AutomationScheduleReservation[];
  now?: number;
}) {
  const originalTime = new Date(scheduledAt).getTime();
  if (!Number.isFinite(originalTime)) throw new Error("automation_schedule_date_invalid");
  if (originalTime <= now) throw new Error("automation_scheduled_at_in_past");

  const earliestAllowed = now + AUTOMATION_SCHEDULE_MIN_LEAD_MS;
  let candidate = originalTime;
  if (candidate < earliestAllowed) {
    const daysToAdvance = Math.ceil((earliestAllowed - candidate) / DAY_MS);
    candidate += daysToAdvance * DAY_MS;
  }
  const latestAllowed = candidate + MAX_SCHEDULE_SEARCH_MS;

  const accountSet = new Set(accountIds);
  const accountReservations = reservations.flatMap((reservation) => {
    if (!accountSet.has(reservation.accountId)) return [];
    const timestamp = new Date(reservation.scheduledAt).getTime();
    return Number.isFinite(timestamp) ? [timestamp] : [];
  });

  while (candidate <= latestAllowed) {
    const conflicts = accountReservations.filter((reservedAt) => Math.abs(candidate - reservedAt) < AUTOMATION_MIN_ACCOUNT_SCHEDULE_GAP_MS);
    if (!conflicts.length) {
      return candidate === originalTime ? scheduledAt : new Date(candidate).toISOString();
    }
    candidate = Math.max(candidate + AUTOMATION_MIN_ACCOUNT_SCHEDULE_GAP_MS, ...conflicts.map((reservedAt) => reservedAt + AUTOMATION_MIN_ACCOUNT_SCHEDULE_GAP_MS));
  }

  throw new Error("automation_schedule_slot_unavailable");
}
