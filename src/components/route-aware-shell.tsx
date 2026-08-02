"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PageTransitionShell } from "@/components/page-transition-shell";
import { cn } from "@/lib/utils";

export function RouteAwareShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAccountPage = pathname === "/profile" || pathname.startsWith("/account/");
  const hidesMobileBottomNav = pathname === "/pricing" || pathname === "/content-automation" || pathname.startsWith("/content-automation/");
  const isAutomationTable = pathname === "/content-automation/automations";
  const isFullScreenStudy =
    pathname === "/learn" ||
    pathname === "/learned" ||
    pathname === "/leaderboard" ||
    pathname.startsWith("/games/");

  return (
    <main
      id="main-content"
      data-mobile-hide-bottom-nav={isFullScreenStudy || hidesMobileBottomNav || undefined}
      className={cn(
        "flex-1 outline-none",
        isAutomationTable && "fixed inset-x-0 bottom-0 top-[var(--app-header-height)] z-30 overflow-hidden",
        !isAccountPage && !isFullScreenStudy && !hidesMobileBottomNav && "max-lg:pb-[var(--mobile-nav-bar-height)]",
        (pathname === "/games" ||
          pathname.startsWith("/games/") ||
          pathname === "/leaderboard") &&
          "h-[calc(100dvh-var(--app-header-height))] overflow-hidden",
      )}
      tabIndex={-1}
    >
      <PageTransitionShell>{children}</PageTransitionShell>
    </main>
  );
}
