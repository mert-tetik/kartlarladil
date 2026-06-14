import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";
import type { LanguageCode, LocaleCode, Tier } from "@/types/domain";
import type { AuthProfile, AuthShellUser } from "@/features/auth/auth-types";
import { DEFAULT_AUTH_REDIRECT, getSafeNextPath } from "@/features/auth/auth-redirects";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LANGUAGE_CODE_SET = new Set<LanguageCode>(LANGUAGE_CODES);
const LOCALE_CODE_SET = new Set<LocaleCode>(LOCALE_CODES);
const TIERS = new Set<Tier>(["A1", "A2", "B1", "B2", "C1"]);

interface ProfileRow {
  display_name: string | null;
  preferred_language_code: string | null;
  preferred_ui_locale: string | null;
  preferred_tier: string | null;
  onboarding_completed: boolean | null;
}

function normalizeProfile(row?: ProfileRow | null): AuthProfile {
  const preferredLanguageCode = row?.preferred_language_code;
  const preferredUiLocale = row?.preferred_ui_locale;
  const preferredTier = row?.preferred_tier;

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
    preferredTier: preferredTier && TIERS.has(preferredTier as Tier) ? (preferredTier as Tier) : null,
  };
}

export async function getRequestOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");

  if (origin) {
    return origin;
  }

  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

async function readProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("display_name, preferred_language_code, preferred_ui_locale, preferred_tier, onboarding_completed")
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();

  if (error) {
    return null;
  }

  return data;
}

function getMetadataString(user: User, key: string) {
  const value = user.user_metadata?.[key];
  return typeof value === "string" ? value : null;
}

export async function ensureUserProfile(
  supabase: SupabaseClient,
  user: User,
  preferences?: {
    displayName?: string | null;
    preferredLanguageCode?: LanguageCode | null;
    preferredUiLocale?: LocaleCode | null;
    preferredTier?: Tier | null;
  },
): Promise<{ profile: AuthProfile; onboardingCompleted: boolean }> {
  const existingProfile = await readProfile(supabase, user.id);

  if (existingProfile) {
    return {
      profile: normalizeProfile(existingProfile),
      onboardingCompleted: existingProfile.onboarding_completed ?? true,
    };
  }

  const metadataLanguage = getMetadataString(user, "preferred_language_code");
  const metadataUiLocale = getMetadataString(user, "preferred_ui_locale");
  const metadataTier = getMetadataString(user, "preferred_tier");

  const { data, error } = await supabase
    .from("user_profiles")
    .insert({
      user_id: user.id,
      display_name: preferences?.displayName?.trim() || getMetadataString(user, "display_name") || null,
      preferred_language_code:
        preferences?.preferredLanguageCode ??
        (LANGUAGE_CODE_SET.has(metadataLanguage as LanguageCode) ? (metadataLanguage as LanguageCode) : "en"),
      preferred_ui_locale:
        preferences?.preferredUiLocale ??
        (LOCALE_CODE_SET.has(metadataUiLocale as LocaleCode) ? (metadataUiLocale as LocaleCode) : "en"),
      preferred_tier:
        preferences?.preferredTier ?? (TIERS.has(metadataTier as Tier) ? (metadataTier as Tier) : "A1"),
      onboarding_completed: false,
    })
    .select("display_name, preferred_language_code, preferred_ui_locale, preferred_tier, onboarding_completed")
    .maybeSingle<ProfileRow>();

  if (error) {
    return { profile: normalizeProfile(), onboardingCompleted: false };
  }

  return {
    profile: normalizeProfile(data),
    onboardingCompleted: data?.onboarding_completed ?? false,
  };
}

export async function getCurrentAuthUser(): Promise<AuthShellUser | null> {
  if (!hasSupabaseBrowserConfig()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return null;
  }

  const profile = normalizeProfile(await readProfile(supabase, user.id));

  return {
    id: user.id,
    email: user.email,
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
