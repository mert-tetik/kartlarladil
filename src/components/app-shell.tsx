import type { ReactNode } from "react";
import { BodyScrollLock } from "@/components/body-scroll-lock";
import { CookieNotice } from "@/components/cookie-notice";
import { GlobalTapVibration } from "@/components/global-tap-vibration";
import { AppNavigation } from "@/components/app-navigation";
import { MobileViewportController } from "@/components/mobile-viewport-controller";
import { RouteAwareShell } from "@/components/route-aware-shell";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider } from "@/components/theme-provider";
import { TwaAnalyticsProvider } from "@/components/twa-analytics-provider";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import { MobileAuthGateway } from "@/features/auth/components/mobile-auth-gateway";
import { PostPracticeLeaderboardConsentGate } from "@/features/leaderboard/components/post-practice-leaderboard-consent-gate";
import { PushNotificationsProvider } from "@/features/push/components/push-notifications-provider";
import { ProgressStatsProvider } from "@/features/progress/progress-client";
import { RankUpTestOverlay } from "@/features/progress/components/rank-up-test-overlay";
import { SubscriptionProvider } from "@/features/subscriptions/subscription-client";
import { LandingTutorial } from "@/features/tutorial/landing-tutorial";
import { LocaleProvider } from "@/i18n/locale-provider";

import type { AuthShellUser } from "@/features/auth/auth-types";
import type { LocaleCode } from "@/types/domain";

export function AppShell({
  children,
  locale,
  user,
  onboardingCountryCode,
}: {
  children: ReactNode;
  locale: LocaleCode;
  user: AuthShellUser | null;
  onboardingCountryCode: string | null;
}) {
  return (
    <LocaleProvider initialLocale={locale}>
      <BodyScrollLock />
      <MobileViewportController />
      <GlobalTapVibration />
      <AuthSessionProvider user={user}>
        <TwaAnalyticsProvider>
          <SubscriptionProvider>
            <ProgressStatsProvider>
              <ThemeProvider initialTheme={user?.profile.theme}>
                <PushNotificationsProvider>
                  <div className="flex min-h-screen flex-col bg-background text-foreground">
                    <AppNavigation user={user} />
                    <RankUpTestOverlay />
                    <MobileAuthGateway countryCode={onboardingCountryCode} />
                    <PostPracticeLeaderboardConsentGate />
                    <RouteAwareShell>{children}</RouteAwareShell>
                    <SiteFooter className="max-lg:hidden" />
                    <CookieNotice />
                    <LandingTutorial />
                  </div>
                </PushNotificationsProvider>
              </ThemeProvider>
            </ProgressStatsProvider>
          </SubscriptionProvider>
        </TwaAnalyticsProvider>
      </AuthSessionProvider>
    </LocaleProvider>
  );
}
