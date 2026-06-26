"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { normalizePreferredTier } from "@/features/auth/preferred-tier";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import type { AuthShellUser } from "@/features/auth/auth-types";
import { DEFAULT_AUTH_REDIRECT, getSafeNextPath } from "@/features/auth/auth-redirects";
import type { LanguageCode, LocaleCode } from "@/types/domain";

interface AuthSessionContextValue {
  user: AuthShellUser | null;
  refreshProfile: () => Promise<void>;
}

interface RequireAuthActionOptions {
  nextPath?: string;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

const LANGUAGE_CODES: LanguageCode[] = [
  "tr",
  "en",
  "de",
  "ru",
  "fr",
  "es",
  "it",
  "pt",
  "nl",
  "pl",
  "ar",
  "ja",
  "ko",
  "zh-CN",
];
const LOCALE_CODES: LocaleCode[] = LANGUAGE_CODES;

function normalizeClientProfile(row: {
  display_name: string | null;
  preferred_language_code: string | null;
  preferred_ui_locale: string | null;
  preferred_tier: string | null;
  onboarding_completed: boolean | null;
  ai_practice_points: number | null;
  chest_points: number | null;
}): AuthShellUser["profile"] {
  const preferredLanguageCode = row.preferred_language_code;
  const preferredUiLocale = row.preferred_ui_locale;
  const preferredTier = row.preferred_tier;

  return {
    displayName: row.display_name ?? null,
    preferredLanguageCode:
      preferredLanguageCode && LANGUAGE_CODES.includes(preferredLanguageCode as LanguageCode)
        ? (preferredLanguageCode as LanguageCode)
        : null,
    preferredUiLocale:
      preferredUiLocale && LOCALE_CODES.includes(preferredUiLocale as LocaleCode)
        ? (preferredUiLocale as LocaleCode)
        : null,
    preferredTier: normalizePreferredTier(preferredTier),
    onboardingCompleted: row.onboarding_completed ?? true,
    aiPracticePoints: row.ai_practice_points ?? 0,
    chestPoints: row.chest_points ?? 0,
  };
}

export function AuthSessionProvider({
  user: initialUser,
  children,
}: {
  user: AuthShellUser | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState(initialUser);
  const client = useMemo(() => (hasSupabaseBrowserConfig() ? createSupabaseBrowserClient() : null), []);

  useEffect(() => {
    if (!client) {
      return;
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [client]);

  const refreshProfile = useCallback(async () => {
    if (!client || !user) {
      return;
    }

    const {
      data: { session },
    } = await client.auth.getSession();

    if (!session) {
      return;
    }

    const { data, error } = await client
      .from("user_profiles")
      .select("display_name, preferred_language_code, preferred_ui_locale, preferred_tier, onboarding_completed, ai_practice_points, chest_points")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error || !data) {
      return;
    }

    setUser((current) =>
      current
        ? {
            ...current,
            profile: normalizeClientProfile(data),
          }
        : current,
    );
  }, [client, user]);

  const value = useMemo(
    () => ({
      user,
      refreshProfile,
    }),
    [user, refreshProfile],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useAuthSession must be used inside AuthSessionProvider.");
  }

  return context;
}

export function useRequireAuthAction() {
  const { user } = useAuthSession();
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    <T,>(action: () => T, options?: RequireAuthActionOptions): T | undefined => {
      if (user) {
        return action();
      }

      const nextPath = getSafeNextPath(options?.nextPath ?? getCurrentClientPath(pathname), DEFAULT_AUTH_REDIRECT);
      router.push(`/register?next=${encodeURIComponent(nextPath)}`);

      return undefined;
    },
    [pathname, router, user],
  );
}

function getCurrentClientPath(pathname: string) {
  if (typeof window === "undefined") {
    return pathname || DEFAULT_AUTH_REDIRECT;
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
