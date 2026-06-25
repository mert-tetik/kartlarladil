"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PageTransitionShell } from "@/components/page-transition-shell";
import { cn } from "@/lib/utils";

export function RouteAwareShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAccountPage = pathname === "/profile" || pathname.startsWith("/account/");

  return (
    <main
      id="main-content"
      className={cn(
        "flex-1 outline-none",
        !isAccountPage && "max-lg:pb-[var(--mobile-nav-bar-height)]",
      )}
      tabIndex={-1}
    >
      <PageTransitionShell>{children}</PageTransitionShell>
    </main>
  );
}
