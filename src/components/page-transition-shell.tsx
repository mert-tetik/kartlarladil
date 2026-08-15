"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ROUTE_TRANSITION_COVER_DURATION_MS,
  subscribeRouteTransition,
} from "@/lib/route-transition";
import { cn } from "@/lib/utils";

const COVER_DURATION_MS = ROUTE_TRANSITION_COVER_DURATION_MS;
const ENTER_DURATION_MS = 480;
const MAX_ENTER_DELAY_MS = 360;
const TOTAL_ENTER_DURATION_MS = ENTER_DURATION_MS + MAX_ENTER_DELAY_MS;

type RouteTransitionPhase = "idle" | "covering" | "preparing" | "entering";

function applyRouteTransitionPhase(phase: RouteTransitionPhase) {
  if (phase === "idle") {
    delete document.documentElement.dataset.routeTransition;
    return;
  }

  document.documentElement.dataset.routeTransition = phase;
}

export function PageTransitionShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const isFullScreenRoute =
    pathname === "/learn" ||
    pathname === "/learned" ||
    pathname === "/leaderboard" ||
    pathname.startsWith("/games/");
  const isAutomationTable =
    pathname === "/content-automation/automations" ||
    pathname === "/content-automation/test-automations";
  const [transitionPhase, setTransitionPhase] = useState<RouteTransitionPhase>("idle");
  const transitionStartedAtRef = useRef<number | null>(null);
  const coverTimerRef = useRef<number | null>(null);
  const entryTimerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const contentWaitTimerRef = useRef<number | null>(null);
  const contentObserverRef = useRef<MutationObserver | null>(null);
  const previousRouteKeyRef = useRef(routeKey);
  const mainRef = useRef<HTMLElement>(null);

  const clearRouteTransitionItems = useEffectEvent(() => {
    mainRef.current?.querySelectorAll<HTMLElement>("[data-route-transition-item]").forEach((element) => {
      element.removeAttribute("data-route-transition-item");
      element.style.removeProperty("--route-enter-delay");
    });
  });

  const prepareRouteTransitionItems = useEffectEvent(() => {
    clearRouteTransitionItems();

    const root = mainRef.current;
    if (!root) return 0;

    const viewportHeight = Math.max(window.innerHeight, 1);
    const candidates = root.querySelectorAll<HTMLElement>(
      "button, a[href], input, select, textarea, [role='button'], h1, h2, h3, h4, p, label, img",
    );

    let itemCount = 0;

    candidates.forEach((element) => {
      const interactiveParent = element.closest("button, a[href], [role='button']");
      if (interactiveParent && interactiveParent !== element) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < viewportHeight;
      if (!isVisible) return;

      const verticalProgress = Math.min(1, Math.max(0, rect.top / viewportHeight));
      const delay = Math.round(30 + verticalProgress * (MAX_ENTER_DELAY_MS - 30));
      element.dataset.routeTransitionItem = "";
      element.style.setProperty("--route-enter-delay", `${delay}ms`);
      itemCount += 1;
    });

    return itemCount;
  });

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
      if (contentWaitTimerRef.current !== null) {
        window.clearTimeout(contentWaitTimerRef.current);
        contentWaitTimerRef.current = null;
      }
      contentObserverRef.current?.disconnect();
      contentObserverRef.current = null;
    }

    function startRouteTransition() {
      clearTransitionTimers();
      transitionStartedAtRef.current = window.performance.now();
      applyRouteTransitionPhase("covering");
      setTransitionPhase("covering");
    }

    const unsubscribe = subscribeRouteTransition(startRouteTransition);

    return () => {
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
      const root = mainRef.current;
      let entranceStarted = false;

      function startEntrance() {
        if (entranceStarted) return;
        entranceStarted = true;
        contentObserverRef.current?.disconnect();
        contentObserverRef.current = null;
        if (contentWaitTimerRef.current !== null) {
          window.clearTimeout(contentWaitTimerRef.current);
          contentWaitTimerRef.current = null;
        }

        applyRouteTransitionPhase("preparing");
        setTransitionPhase("preparing");
        // Commit the off-screen placement before the entrance animation starts.
        void mainRef.current?.offsetWidth;
        animationFrameRef.current = window.requestAnimationFrame(() => {
          animationFrameRef.current = window.requestAnimationFrame(() => {
            applyRouteTransitionPhase("entering");
            setTransitionPhase("entering");
            entryTimerRef.current = window.setTimeout(() => {
              applyRouteTransitionPhase("idle");
              transitionStartedAtRef.current = null;
              setTransitionPhase("idle");
            }, TOTAL_ENTER_DURATION_MS);
          });
        });
      }

      function prepareTargetContent() {
        if (prepareRouteTransitionItems() > 0) {
          startEntrance();
        }
      }

      prepareTargetContent();
      if (entranceStarted || !root) return;

      contentObserverRef.current = new MutationObserver(prepareTargetContent);
      contentObserverRef.current.observe(root, { childList: true, subtree: true });
      contentWaitTimerRef.current = window.setTimeout(() => {
        startEntrance();
      }, 10000);
    }, remainingCoverTime);

    coverTimerRef.current = coverTimer;
    return () => {
      window.clearTimeout(coverTimer);
      contentObserverRef.current?.disconnect();
      contentObserverRef.current = null;
      if (contentWaitTimerRef.current !== null) {
        window.clearTimeout(contentWaitTimerRef.current);
        contentWaitTimerRef.current = null;
      }
    };
  }, [routeKey]);

  useEffect(() => {
    if (transitionPhase === "idle") {
      applyRouteTransitionPhase("idle");
      clearRouteTransitionItems();
      return;
    }

    applyRouteTransitionPhase(transitionPhase);
  }, [transitionPhase]);

  return (
    <>
      <div aria-hidden="true" className="route-transition-curtain" />
      <main
        ref={mainRef}
        key={pathname}
        className={cn(
          "page-transition-shell lg:pb-0",
          isAutomationTable && "h-full overflow-hidden pb-0",
          !isFullScreenRoute && !isAutomationTable && "pb-24",
        )}
      >
        {children}
      </main>
    </>
  );
}
