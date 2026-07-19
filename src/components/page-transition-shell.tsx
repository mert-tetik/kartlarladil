"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { beginNavigationIntent } from "@/lib/navigation-intent";
import { requestRouteTransition, subscribeRouteTransition } from "@/lib/route-transition";
import { cn } from "@/lib/utils";

const COVER_DURATION_MS = 360;
const ENTER_DURATION_MS = 480;

type RouteTransitionPhase = "idle" | "covering" | "preparing" | "entering";

export function PageTransitionShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const isFullScreenRoute =
    pathname === "/learn" ||
    pathname === "/learned" ||
    pathname === "/leaderboard" ||
    pathname.startsWith("/games/");
  const [transitionPhase, setTransitionPhase] = useState<RouteTransitionPhase>("idle");
  const transitionStartedAtRef = useRef<number | null>(null);
  const coverTimerRef = useRef<number | null>(null);
  const entryTimerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previousRouteKeyRef = useRef(routeKey);

  useEffect(() => {
    function clearTransitionTimers() {
      if (coverTimerRef.current !== null) {
        window.clearTimeout(coverTimerRef.current);
        coverTimerRef.current = null;
      }
      if (entryTimerRef.current !== null) {
        window.clearTimeout(entryTimerRef.current);
        entryTimerRef.current = null;
      }
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    function startRouteTransition() {
      clearTransitionTimers();
      transitionStartedAtRef.current = window.performance.now();
      setTransitionPhase("covering");
    }

    function startNavigationSignal(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const interactiveElement = (event.target as Element | null)?.closest(
        "a[href], button, [role='button']",
      );

      if (!(interactiveElement instanceof HTMLElement)) {
        return;
      }

      if (interactiveElement instanceof HTMLButtonElement && interactiveElement.disabled) {
        return;
      }

      // Any new user action cancels a pending asynchronous navigation.
      beginNavigationIntent();

      const anchor = interactiveElement.closest("a[href]");

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

      requestRouteTransition();
    }

    window.addEventListener("click", startNavigationSignal, true);
    const unsubscribe = subscribeRouteTransition(startRouteTransition);

    return () => {
      window.removeEventListener("click", startNavigationSignal, true);
      unsubscribe();
      clearTransitionTimers();
    };
  }, []);

  useEffect(() => {
    if (previousRouteKeyRef.current === routeKey) {
      return;
    }

    previousRouteKeyRef.current = routeKey;

    const elapsed = transitionStartedAtRef.current
      ? window.performance.now() - transitionStartedAtRef.current
      : COVER_DURATION_MS;
    const remainingCoverTime = Math.max(0, COVER_DURATION_MS - elapsed);

    const coverTimer = window.setTimeout(() => {
      setTransitionPhase("preparing");
      animationFrameRef.current = window.requestAnimationFrame(() => {
        setTransitionPhase("entering");
        entryTimerRef.current = window.setTimeout(() => {
          transitionStartedAtRef.current = null;
          setTransitionPhase("idle");
        }, ENTER_DURATION_MS);
      });
    }, remainingCoverTime);

    coverTimerRef.current = coverTimer;
    return () => window.clearTimeout(coverTimer);
  }, [routeKey]);

  useEffect(() => {
    if (transitionPhase === "idle") {
      delete document.documentElement.dataset.routeTransition;
      return;
    }

    document.documentElement.dataset.routeTransition = transitionPhase;
  }, [transitionPhase]);

  return (
    <>
      <div aria-hidden="true" className="route-transition-curtain" />
      <main
        key={pathname}
        className={cn(
          "page-transition-shell lg:pb-0",
          !isFullScreenRoute && "pb-24",
        )}
      >
        {children}
      </main>
    </>
  );
}
