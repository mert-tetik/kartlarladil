import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";
import { isPreferredTier, normalizePreferredTier } from "@/features/auth/preferred-tier";
import type { LanguageCode, LocaleCode, PreferredTier } from "@/types/domain";
import type { AuthProfile, AuthShellUser } from "@/features/auth/auth-types";
import { DEFAULT_AUTH_REDIRECT, getSafeNextPath } from "@/features/auth/auth-redirects";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProfileUserFingerprint, logProfileEvent } from "@/features/auth/profile-observability";

const LANGUAGE_CODE_SET = new Set<LanguageCode>(LANGUAGE_CODES);
const LOCALE_CODE_SET = new Set<LocaleCode>(LOCALE_CODES);
const PROFILE_SELECT_BASE = "display_name, preferred_language_code, preferred_ui_locale, onboarding_completed, ai_practice_points, chest_points, streak_points, mission_points, quiz_result_points, game_points, gem_points, blue_gems, green_gems, purple_gems, push_marketing_enabled, leaderboard_visible, theme, profile_picture_index";
const PROFILE_SELECT_WITH_MEDALS = `${PROFILE_SELECT_BASE}, quiz_result_medals`;

interface ProfileRow {
  display_name: string | null;
  preferred_language_code: string | null;
  preferred_ui_locale: string | null;
  preferred_tier: string | null;
  onboarding_completed: boolean | null;
  ai_practice_points: number | null;
  chest_points: number | null;
  streak_points: number | null;
  mission_points: number | null;
  quiz_result_points: number | null;
  quiz_result_medals?: number | null;
  game_points?: number | null;
  gem_points?: number | null;
  blue_gems?: number | null;
  green_gems?: number | null;
  purple_gems?: number | null;
  push_marketing_enabled: boolean | null;
  leaderboard_visible: boolean | null;
  theme: string | null;
  profile_picture_index: number | null;
}

function normalizeProfile(row?: ProfileRow | null): AuthProfile {
  const preferredLanguageCode = row?.preferred_language_code;
  const preferredUiLocale = row?.preferred_ui_locale;
  const preferredTier = row?.preferred_tier;
  const profilePictureIndex = row?.profile_picture_index;

  return {
    displayName: row?.display_name ?? null,
    preferredLanguageCode:
      preferredLanguageCode && LANGUAGE_CODE_SET.has(preferredLanguageCode as LanguageCode)
        ? (preferredLanguageCode as LanguageCode)
        : null,
    preferredUiLocale:
      preferredUiLocale && LOCALE_CODE_SET.has(preferredUiLocale as LocaleCode)
        ? (preferredUiLocale as LocaleCode)
        : null,
    preferredTier: normalizePreferredTier(preferredTier),
    onboardingCompleted: row?.onboarding_completed ?? true,
    aiPracticePoints: row?.ai_practice_points ?? 0,
    chestPoints: row?.chest_points ?? 0,
    streakPoints: row?.streak_points ?? 0,
    missionPoints: row?.mission_points ?? 0,
    quizResultPoints: row?.quiz_result_points ?? 0,
    quizResultMedals: row?.quiz_result_medals ?? 0,
    gamePoints: row?.game_points ?? 0,
    gemPoints: row?.gem_points ?? 0,
    blueGems: row?.blue_gems ?? 0,
    greenGems: row?.green_gems ?? 0,
    purpleGems: row?.purple_gems ?? 0,
    pushMarketingEnabled: row?.push_marketing_enabled ?? false,
    leaderboardVisible: row?.leaderboard_visible ?? false,
    theme: row?.theme ?? null,
    profilePictureIndex:
      typeof profilePictureIndex === "number" &&
      Number.isInteger(profilePictureIndex) &&
      profilePictureIndex >= 0 &&
      profilePictureIndex <= 18
        ? profilePictureIndex
        : null,
  };
}

export async function getRequestOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).origin;
    } catch {
      throw new Error("NEXT_PUBLIC_SITE_URL must be a valid absolute URL.");
    }
  }

  const headerStore = await headers();

  const forwardedHost = headerStore.get("x-forwarded-host");
  const forwardedProto = headerStore.get("x-forwarded-proto");

  if (forwardedHost && forwardedProto) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  const origin = headerStore.get("origin");
  if (origin) {
    return origin;
  }

  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";

  return `${protocol}://${host}`;
}

async function readProfile(supabase: SupabaseClient, userId: string) {
  const result = await supabase
    .from("user_profiles")
    .select(PROFILE_SELECT_WITH_MEDALS)
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();

  if (!result.error) {
    return { profile: result.data, error: null };
  }

  // Keep auth/profile rendering alive while the new balance column is waiting
  // to be applied to the remote Supabase project.
  if (result.error.code !== "42703" || !result.error.message?.includes("quiz_result_medals")) {
    return { profile: null, error: result.error };
  }

  const fallback = await supabase
    .from("user_profiles")
    .select(PROFILE_SELECT_BASE)
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();

  return fallback.error
    ? { profile: null, error: fallback.error }
    : { profile: fallback.data, error: null };
}

function getMetadataString(user: User, key: string) {
  const value = user.user_metadata?.[key];
  return typeof value === "string" ? value : null;
}

function getDisplayNameFromUser(user: User): string | null {
  return (
    getMetadataString(user, "display_name") ||
    getMetadataString(user, "full_name") ||
    getMetadataString(user, "name") ||
    null
  );
}

function getEmailLocalPart(email: string): string | null {
  const localPart = email.split("@")[0]?.trim();
  return localPart && localPart.length > 0 ? localPart : null;
}

function getSafeDisplayName(user: User, preferredName?: string | null) {
  const candidates = [
    { source: "preference", value: preferredName },
    { source: "auth_metadata", value: getDisplayNameFromUser(user) },
    { source: "email_local_part", value: getEmailLocalPart(user.email ?? "") },
  ];

  for (const candidate of candidates) {
    const value = candidate.value?.trim();
    const characterCount = value ? [...value].length : 0;
    if (value && characterCount >= 2 && characterCount <= 80) {
      return { value, source: candidate.source, characterCount };
    }
  }

  return { value: null, source: "none", characterCount: 0 };
}

export type ProfileBootstrapSource =
  | "password_login"
  | "password_signup"
  | "oauth_callback"
  | "server_session"
  | "client_session_recovery";

export async function ensureUserProfile(
  supabase: SupabaseClient,
  user: User,
  preferences?: {
    displayName?: string | null;
    preferredLanguageCode?: LanguageCode | null;
    preferredUiLocale?: LocaleCode | null;
    preferredTier?: PreferredTier | null;
    source?: ProfileBootstrapSource;
  },
): Promise<{
  profile: AuthProfile;
  onboardingCompleted: boolean;
  available: boolean;
  created: boolean;
  errorCode?: string;
}> {
  const source = preferences?.source ?? "server_session";
  const userFingerprint = getProfileUserFingerprint(user.id);
  const { profile: existingProfile, error: readError } = await readProfile(supabase, user.id);

  if (existingProfile) {
    return {
      profile: normalizeProfile(existingProfile),
      onboardingCompleted: existingProfile.onboarding_completed ?? true,
      available: true,
      created: false,
    };
  }

  if (readError) {
    logProfileEvent("error", "profile_read_failed", {
      source,
      userFingerprint,
      errorCode: readError.code ?? "unknown",
    });
    return {
      profile: normalizeProfile(),
      onboardingCompleted: false,
      available: false,
      created: false,
      errorCode: readError.code ?? "unknown",
    };
  }

  const metadataLanguage = getMetadataString(user, "preferred_language_code");
  const metadataUiLocale = getMetadataString(user, "preferred_ui_locale");
  const metadataTier = getMetadataString(user, "preferred_tier");
  const displayName = getSafeDisplayName(user, preferences?.displayName);

  logProfileEvent("warn", "profile_missing_attempting_create", {
    source,
    userFingerprint,
    displayNameSource: displayName.source,
    displayNameLength: displayName.characterCount,
  });

  const { data, error } = await supabase
    .from("user_profiles")
    .insert({
      user_id: user.id,
      display_name: displayName.value,
      preferred_language_code:
        preferences?.preferredLanguageCode ??
        (LANGUAGE_CODE_SET.has(metadataLanguage as LanguageCode) ? (metadataLanguage as LanguageCode) : "en"),
      preferred_ui_locale:
        preferences?.preferredUiLocale ??
        (LOCALE_CODE_SET.has(metadataUiLocale as LocaleCode) ? (metadataUiLocale as LocaleCode) : "en"),
      preferred_tier:
        preferences?.preferredTier ?? (isPreferredTier(metadataTier) ? metadataTier : "A1"),
      onboarding_completed: false,
    })
    .select(PROFILE_SELECT_BASE)
    .maybeSingle<ProfileRow>();

  if (error) {
    if (error.code === "23505") {
      const retry = await readProfile(supabase, user.id);
      if (retry.profile) {
        logProfileEvent("info", "profile_create_race_recovered", {
          source,
          userFingerprint,
        });
        return {
          profile: normalizeProfile(retry.profile),
          onboardingCompleted: retry.profile.onboarding_completed ?? true,
          available: true,
          created: false,
        };
      }
    }

    logProfileEvent("error", "profile_create_failed", {
      source,
      userFingerprint,
      errorCode: error.code ?? "unknown",
      errorKind: error.code === "23514" ? "check_constraint" : "database_error",
    });
    return {
      profile: normalizeProfile(),
      onboardingCompleted: false,
      available: false,
      created: false,
      errorCode: error.code ?? "unknown",
    };
  }

  if (!data) {
    logProfileEvent("error", "profile_create_returned_empty", {
      source,
      userFingerprint,
    });
    return {
      profile: normalizeProfile(),
      onboardingCompleted: false,
      available: false,
      created: false,
      errorCode: "empty_result",
    };
  }

  logProfileEvent("info", "profile_created", {
    source,
    userFingerprint,
    displayNameSource: displayName.source,
    displayNameLength: displayName.characterCount,
  });

  return {
    profile: normalizeProfile(data),
    onboardingCompleted: data?.onboarding_completed ?? false,
    available: true,
    created: true,
  };
}

export async function getCurrentAuthUser(): Promise<AuthShellUser | null> {
  if (!hasSupabaseBrowserConfig()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();

  // The middleware already verifies and refreshes the session, so we can read
  // the current session locally instead of calling getUser() on every render.
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user?.email) {
    return null;
  }

  const user = session.user;
  const email = user.email;

  if (!email) {
    return null;
  }

  // The native OAuth deep-link callback exchanges the code in the existing
  // WebView, so it does not pass through /auth/callback. Bootstrap the profile
  // here as the shared server-side session boundary instead of relying on one
  // particular OAuth callback route to create it.
  const { profile } = await ensureUserProfile(supabase, user, { source: "server_session" });

  return {
    id: user.id,
    email,
    profile,
  };
}

export async function requireAuthUser(nextPath: string) {
  const user = await getCurrentAuthUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(getSafeNextPath(nextPath, DEFAULT_AUTH_REDIRECT))}`);
  }

  return user;
}
