"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PageTransitionShell } from "@/components/page-transition-shell";
import { cn } from "@/lib/utils";

export function RouteAwareShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAccountPage = pathname === "/profile" || pathname.startsWith("/account/");
  const isFullScreenStudy = pathname === "/learn" || pathname === "/learned" || pathname.startsWith("/games/");

  return (
    <main
      id="main-content"
      data-mobile-hide-bottom-nav={isFullScreenStudy || undefined}
      className={cn(
        "flex-1 outline-none",
        !isAccountPage && !isFullScreenStudy && "max-lg:pb-[var(--mobile-nav-bar-height)]",
        (pathname === "/games" || pathname.startsWith("/games/")) && "h-[calc(100dvh-var(--app-header-height))] overflow-hidden",
      )}
      tabIndex={-1}
    >
      <PageTransitionShell>{children}</PageTransitionShell>
    </main>
  );
}
