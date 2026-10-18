const MAX_UPLOAD_POST_SCHEDULE_AHEAD_MS = 365 * 24 * 60 * 60 * 1_000;

export function getUploadPostScheduleFields(scheduledFor?: string, now = Date.now()): Array<[string, string]> {
  if (!scheduledFor) return [];

  const scheduledDate = new Date(scheduledFor);
  if (!Number.isFinite(scheduledDate.getTime())
    || scheduledDate.getTime() <= now
    || scheduledDate.getTime() > now + MAX_UPLOAD_POST_SCHEDULE_AHEAD_MS) {
    throw new Error("invalid_scheduled_date");
  }

  // Send an absolute UTC instant and omit `timezone`. Upload-Post interprets
  // `scheduled_date` in the supplied timezone when one is present; pairing a
  // Z-suffixed timestamp with Europe/Istanbul would reinterpret its UTC hour.
  return [["scheduled_date", scheduledDate.toISOString()]];
}
