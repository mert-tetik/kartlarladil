import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";
import { isPreferredTier } from "@/features/auth/preferred-tier";
import type { AuthProfile } from "@/features/auth/auth-types";
import type { LanguageCode, LocaleCode } from "@/types/domain";

const CACHE_VERSION = 1;
const CACHE_PREFIX = "foxiesdeck:auth-profile:v1:";

interface CachedAuthProfile {
  version: number;
  userId: string;
  savedAt: number;
  profile: AuthProfile;
}

function getCacheKey(userId: string) {
  return `${CACHE_PREFIX}${encodeURIComponent(userId)}`;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeCachedProfile(value: unknown): AuthProfile | null {
  if (!value || typeof value !== "object") return null;
  const profile = value as Record<string, unknown>;
  if (
    !isNullableString(profile.displayName) ||
    (profile.preferredLanguageCode !== null &&
      !(LANGUAGE_CODES as readonly string[]).includes(profile.preferredLanguageCode as string)) ||
    (profile.preferredUiLocale !== null &&
      !(LOCALE_CODES as readonly string[]).includes(profile.preferredUiLocale as string)) ||
    (profile.preferredTier !== null && !isPreferredTier(profile.preferredTier as string)) ||
    typeof profile.onboardingCompleted !== "boolean" ||
    !isNonNegativeNumber(profile.aiPracticePoints) ||
    !isNonNegativeNumber(profile.chestPoints)
  ) {
    return null;
  }

  const optionalCounters = [
    "streakPoints",
    "missionPoints",
    "quizResultPoints",
    "quizResultMedals",
    "gamePoints",
    "gemPoints",
    "blueGems",
    "greenGems",
    "purpleGems",
  ] as const;
  for (const key of optionalCounters) {
    if (profile[key] !== undefined && !isNonNegativeNumber(profile[key])) return null;
  }

  if (
    (profile.pushMarketingEnabled !== undefined && typeof profile.pushMarketingEnabled !== "boolean") ||
    (profile.leaderboardVisible !== undefined && typeof profile.leaderboardVisible !== "boolean") ||
    (profile.theme !== undefined && !isNullableString(profile.theme)) ||
    (profile.profilePictureIndex !== undefined &&
      profile.profilePictureIndex !== null &&
      (!Number.isInteger(profile.profilePictureIndex) ||
        (profile.profilePictureIndex as number) < 0 ||
        (profile.profilePictureIndex as number) > 18))
  ) {
    return null;
  }

  return {
    displayName: profile.displayName,
    preferredLanguageCode: profile.preferredLanguageCode as LanguageCode | null,
    preferredUiLocale: profile.preferredUiLocale as LocaleCode | null,
    preferredTier: profile.preferredTier as AuthProfile["preferredTier"],
    onboardingCompleted: profile.onboardingCompleted,
    aiPracticePoints: profile.aiPracticePoints,
    chestPoints: profile.chestPoints,
    streakPoints: profile.streakPoints as number | undefined,
    missionPoints: profile.missionPoints as number | undefined,
    quizResultPoints: profile.quizResultPoints as number | undefined,
    quizResultMedals: profile.quizResultMedals as number | undefined,
    gamePoints: profile.gamePoints as number | undefined,
    gemPoints: profile.gemPoints as number | undefined,
    blueGems: profile.blueGems as number | undefined,
    greenGems: profile.greenGems as number | undefined,
    purpleGems: profile.purpleGems as number | undefined,
    pushMarketingEnabled: profile.pushMarketingEnabled as boolean | undefined,
    leaderboardVisible: profile.leaderboardVisible as boolean | undefined,
    theme: profile.theme as string | null | undefined,
    profilePictureIndex: profile.profilePictureIndex as number | null | undefined,
  };
}

export function readCachedAuthProfile(userId: string): AuthProfile | null {
  if (typeof window === "undefined" || !userId) return null;

  try {
    const raw = window.localStorage.getItem(getCacheKey(userId));
    if (!raw) return null;

    const value = JSON.parse(raw) as Partial<CachedAuthProfile>;
    if (value.version !== CACHE_VERSION || value.userId !== userId) return null;
    return normalizeCachedProfile(value.profile);
  } catch {
    return null;
  }
}

export function writeCachedAuthProfile(userId: string, profile: AuthProfile): void {
  if (typeof window === "undefined" || !userId) return;

  try {
    const value: CachedAuthProfile = {
      version: CACHE_VERSION,
      userId,
      savedAt: Date.now(),
      profile,
    };
    window.localStorage.setItem(getCacheKey(userId), JSON.stringify(value));
  } catch {
    // Local storage is an optimization only; auth and backend data remain authoritative.
  }
}
