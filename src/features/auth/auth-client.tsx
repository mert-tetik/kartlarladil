"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { normalizePreferredTier } from "@/features/auth/preferred-tier";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { beginNavigationIntent } from "@/lib/navigation-intent";
import { navigateWithRouteTransition } from "@/lib/route-transition";
import { setTwaAnalyticsUserId } from "@/lib/twa-analytics";
import type { AuthProfile, AuthShellUser } from "@/features/auth/auth-types";
import { GemOptimisticLedger, type GemSpendReservation } from "@/features/gems/gem-optimistic-ledger";
import type { GemBalances, GemType } from "@/features/gems/gem-types";
import { DEFAULT_AUTH_REDIRECT, getSafeNextPath } from "@/features/auth/auth-redirects";
import type { LanguageCode, LocaleCode } from "@/types/domain";

interface AuthSessionContextValue {
  user: AuthShellUser | null;
  refreshProfile: () => Promise<void>;
  updateProfileField: (updates: Partial<AuthProfile>) => void;
  reserveGemSpend: (type: GemType, amount: number) => GemSpendReservation | null;
  settleGemSpend: (reservation: GemSpendReservation) => void;
  rollbackGemSpend: (reservation: GemSpendReservation) => void;
  clearUser: () => void;
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
const PROFILE_SELECT_BASE = "display_name, preferred_language_code, preferred_ui_locale, preferred_tier, onboarding_completed, ai_practice_points, chest_points, streak_points, mission_points, quiz_result_points, game_points, gem_points, blue_gems, green_gems, purple_gems, push_marketing_enabled, leaderboard_visible, profile_picture_index";
const PROFILE_SELECT_WITH_MEDALS = `${PROFILE_SELECT_BASE}, quiz_result_medals`;

function normalizeClientProfile(row: {
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
  profile_picture_index: number | null;
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
    streakPoints: row.streak_points ?? 0,
    missionPoints: row.mission_points ?? 0,
    quizResultPoints: row.quiz_result_points ?? 0,
    quizResultMedals: row.quiz_result_medals ?? 0,
    gamePoints: row.game_points ?? 0,
    gemPoints: row.gem_points ?? 0,
    blueGems: row.blue_gems ?? 0,
    greenGems: row.green_gems ?? 0,
    purpleGems: row.purple_gems ?? 0,
    pushMarketingEnabled: row.push_marketing_enabled ?? false,
    leaderboardVisible: row.leaderboard_visible ?? false,
    profilePictureIndex:
      typeof row.profile_picture_index === "number" &&
      Number.isInteger(row.profile_picture_index) &&
      row.profile_picture_index >= 0 &&
      row.profile_picture_index <= 18
        ? row.profile_picture_index
        : null,
  };
}

function getGemBalances(profile: AuthProfile | null | undefined): GemBalances {
  return {
    blue: profile?.blueGems ?? 0,
    green: profile?.greenGems ?? 0,
    purple: profile?.purpleGems ?? 0,
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
  const activeUserIdRef = useRef<string | null>(initialUser?.id ?? null);
  const gemLedgerRef = useRef(new GemOptimisticLedger(getGemBalances(initialUser?.profile)));

  const getVisibleGemBalances = useCallback((): GemBalances => ({
    ...gemLedgerRef.current.getVisibleBalances(),
  }), []);

  const applyVisibleGemBalances = useCallback(() => {
    const balances = getVisibleGemBalances();
    setUser((current) => current
      ? {
          ...current,
          profile: {
            ...current.profile,
            blueGems: balances.blue,
            greenGems: balances.green,
            purpleGems: balances.purple,
          },
        }
      : current);
  }, [getVisibleGemBalances]);

  const reserveGemSpend = useCallback((type: GemType, amount: number): GemSpendReservation | null => {
    const userId = activeUserIdRef.current;
    if (!userId) return null;

    const reservation = gemLedgerRef.current.reserve(userId, type, amount);
    if (!reservation) return null;
    applyVisibleGemBalances();
    return reservation;
  }, [applyVisibleGemBalances]);

  const settleGemSpend = useCallback((reservation: GemSpendReservation) => {
    if (!gemLedgerRef.current.settle(reservation)) return;
    applyVisibleGemBalances();
  }, [applyVisibleGemBalances]);

  const rollbackGemSpend = useCallback((reservation: GemSpendReservation) => {
    if (!gemLedgerRef.current.rollback(reservation)) return;
    applyVisibleGemBalances();
  }, [applyVisibleGemBalances]);

  useEffect(() => {
    if (activeUserIdRef.current === user?.id) return;

    activeUserIdRef.current = user?.id ?? null;
    gemLedgerRef.current.reset(getGemBalances(user?.profile));
  }, [user?.id]);

  useEffect(() => {
    setTwaAnalyticsUserId(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        activeUserIdRef.current = null;
        gemLedgerRef.current.reset();
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

    let { data, error } = await client
      .from("user_profiles")
      .select(PROFILE_SELECT_WITH_MEDALS)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error?.code === "42703" && error.message?.includes("quiz_result_medals")) {
      ({ data, error } = await client
        .from("user_profiles")
        .select(PROFILE_SELECT_BASE)
        .eq("user_id", session.user.id)
        .maybeSingle());
    }

    if (error || !data) {
      return;
    }

    const nextProfile = normalizeClientProfile(data);
    gemLedgerRef.current.setConfirmedBalances(getGemBalances(nextProfile));
    const visibleGemBalances = getVisibleGemBalances();
    setUser((current) =>
      current
        ? {
            ...current,
            profile: {
              ...nextProfile,
              blueGems: visibleGemBalances.blue,
              greenGems: visibleGemBalances.green,
              purpleGems: visibleGemBalances.purple,
            },
          }
        : current,
    );
  }, [client, user, getVisibleGemBalances]);

  const updateProfileField = useCallback((updates: Partial<AuthProfile>) => {
    const hasGemBalanceUpdate = updates.blueGems !== undefined || updates.greenGems !== undefined || updates.purpleGems !== undefined;
    if (hasGemBalanceUpdate) {
      const confirmedGemBalances = gemLedgerRef.current.getConfirmedBalances();
      gemLedgerRef.current.setConfirmedBalances({
        blue: updates.blueGems ?? confirmedGemBalances.blue,
        green: updates.greenGems ?? confirmedGemBalances.green,
        purple: updates.purpleGems ?? confirmedGemBalances.purple,
      });
    }

    setUser((current) => {
      if (!current) {
        return current;
      }

      const visibleGemBalances = hasGemBalanceUpdate ? getVisibleGemBalances() : null;

      return {
        ...current,
        profile: {
          ...current.profile,
          ...updates,
          ...(visibleGemBalances
            ? {
                blueGems: visibleGemBalances.blue,
                greenGems: visibleGemBalances.green,
                purpleGems: visibleGemBalances.purple,
              }
            : {}),
        },
      };
    });
  }, [getVisibleGemBalances]);

  const clearUser = useCallback(() => {
    activeUserIdRef.current = null;
    gemLedgerRef.current.reset();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      refreshProfile,
      updateProfileField,
      reserveGemSpend,
      settleGemSpend,
      rollbackGemSpend,
      clearUser,
    }),
    [user, refreshProfile, updateProfileField, reserveGemSpend, settleGemSpend, rollbackGemSpend, clearUser],
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

/** Read session data for passive UI that can also render in isolated previews/tests. */
export function useOptionalAuthSession() {
  return useContext(AuthSessionContext);
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

      // On mobile the full-screen auth gateway is already shown; redirecting to
      // /register would hit the middleware redirect and produce a broken page.
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        return undefined;
      }

      const nextPath = getSafeNextPath(options?.nextPath ?? getCurrentClientPath(pathname), DEFAULT_AUTH_REDIRECT);
      beginNavigationIntent();
      navigateWithRouteTransition(() => router.push(`/register?next=${encodeURIComponent(nextPath)}`));

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
