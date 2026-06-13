import type { ReactNode } from "react";
import { AppNavigation } from "@/components/app-navigation";
import { PageTransitionShell } from "@/components/page-transition-shell";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { ProgressStatsProvider } from "@/features/progress/progress-client";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { LocaleCode } from "@/types/domain";

export async function AppShell({ children, locale }: { children: ReactNode; locale: LocaleCode }) {
  const user = await getCurrentAuthUser();

  return (
    <LocaleProvider initialLocale={locale}>
      <AuthSessionProvider user={user}>
        <ProgressStatsProvider>
          <div className="min-h-screen bg-slate-50 text-slate-950">
            <AppNavigation user={user} />
            <PageTransitionShell>{children}</PageTransitionShell>
          </div>
        </ProgressStatsProvider>
      </AuthSessionProvider>
    </LocaleProvider>
  );
}
