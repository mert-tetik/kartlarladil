import type { ReactNode } from "react";
import { CookieNotice } from "@/components/cookie-notice";
import { AppNavigation } from "@/components/app-navigation";
import { PageTransitionShell } from "@/components/page-transition-shell";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { ProgressStatsProvider } from "@/features/progress/progress-client";
import { SubscriptionProvider } from "@/features/subscriptions/subscription-client";
import { LocaleProvider } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { LocaleCode } from "@/types/domain";

export async function AppShell({ children, locale }: { children: ReactNode; locale: LocaleCode }) {
  const user = await getCurrentAuthUser();

  return (
    <LocaleProvider initialLocale={locale}>
      <AuthSessionProvider user={user}>
        <SubscriptionProvider>
          <ProgressStatsProvider>
            <ThemeProvider initialTheme={user?.profile.theme}>
              <div className="flex min-h-screen flex-col bg-background text-foreground">
                <AppNavigation user={user} />
                <main
                  id="main-content"
                  className={cn("flex-1", "outline-none")}
                  tabIndex={-1}
                >
                  <PageTransitionShell>{children}</PageTransitionShell>
                </main>
                <SiteFooter />
                <CookieNotice />
              </div>
            </ThemeProvider>
          </ProgressStatsProvider>
        </SubscriptionProvider>
      </AuthSessionProvider>
    </LocaleProvider>
  );
}
