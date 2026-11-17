import "server-only";

import { createHash } from "node:crypto";

export function getProfileUserFingerprint(userId: string) {
  return createHash("sha256").update(userId).digest("hex").slice(0, 20);
}

export function logProfileEvent(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, string | number | boolean | null | undefined>,
) {
  const entry = JSON.stringify({
    scope: "profile_bootstrap",
    event,
    ...fields,
  });

  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}
