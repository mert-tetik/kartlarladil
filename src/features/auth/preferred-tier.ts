import { TIERS } from "@/data/tiers";
import type { PreferredTier } from "@/types/domain";

export const PREFERRED_TIERS = [...TIERS, "all"] as const satisfies readonly PreferredTier[];

export function isPreferredTier(value: string | null | undefined): value is PreferredTier {
  return typeof value === "string" && (PREFERRED_TIERS as readonly string[]).includes(value);
}

export function normalizePreferredTier(value: string | null | undefined): PreferredTier | null {
  return isPreferredTier(value) ? value : null;
}
