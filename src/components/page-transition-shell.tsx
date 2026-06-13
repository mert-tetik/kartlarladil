"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function PageTransitionShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [navigationPending, setNavigationPending] = useState(false);
  const pendingTimerRef = useRef<number | null>(null);
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    function clearPendingTimer() {
      if (pendingTimerRef.current) {
        window.clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    }

    function startNavigationSignal(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target || anchor.hasAttribute("download")) {
        return;
      }

      const targetUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      const sameOrigin = targetUrl.origin === currentUrl.origin;
      const sameRoute = targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search;

      if (!sameOrigin || sameRoute) {
        return;
      }

      setNavigationPending(true);
      clearPendingTimer();
      pendingTimerRef.current = window.setTimeout(() => setNavigationPending(false), 1600);
    }

    window.addEventListener("click", startNavigationSignal, true);

    return () => {
      window.removeEventListener("click", startNavigationSignal, true);
      clearPendingTimer();
    };
  }, []);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) {
      return;
    }

    previousPathnameRef.current = pathname;

    if (!navigationPending) {
      return;
    }

    const settleTimer = window.setTimeout(() => setNavigationPending(false), 220);

    return () => window.clearTimeout(settleTimer);
  }, [navigationPending, pathname]);

  return (
    <>
      <div
        aria-hidden="true"
        className={navigationPending ? "route-progress-indicator is-active" : "route-progress-indicator"}
      />
      <main key={pathname} className="page-transition-shell pb-24 lg:pb-0">
        {children}
      </main>
    </>
  );
}
