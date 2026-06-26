import type { ReactNode } from "react";
import { BodyScrollLock } from "@/components/body-scroll-lock";
import { CookieNotice } from "@/components/cookie-notice";
import { GlobalTapVibration } from "@/components/global-tap-vibration";
import { AppNavigation } from "@/components/app-navigation";
import { MobileViewportController } from "@/components/mobile-viewport-controller";
import { RouteAwareShell } from "@/components/route-aware-shell";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import { MobileAuthGateway } from "@/features/auth/components/mobile-auth-gateway";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { ProgressStatsProvider } from "@/features/progress/progress-client";
import { SubscriptionProvider } from "@/features/subscriptions/subscription-client";
import { LocaleProvider } from "@/i18n/locale-provider";

import type { LocaleCode } from "@/types/domain";

export async function AppShell({ children, locale }: { children: ReactNode; locale: LocaleCode }) {
  const user = await getCurrentAuthUser();

  return (
    <LocaleProvider initialLocale={locale}>
      <BodyScrollLock />
      <MobileViewportController />
      <GlobalTapVibration />
      <AuthSessionProvider user={user}>
        <SubscriptionProvider>
          <ProgressStatsProvider>
            <ThemeProvider initialTheme={user?.profile.theme}>
              <div className="flex min-h-screen flex-col bg-background text-foreground">
                <AppNavigation user={user} />
                <MobileAuthGateway />
                <RouteAwareShell>{children}</RouteAwareShell>
                <SiteFooter className="max-lg:hidden" />
                <CookieNotice />
              </div>
            </ThemeProvider>
          </ProgressStatsProvider>
        </SubscriptionProvider>
      </AuthSessionProvider>
    </LocaleProvider>
  );
}
