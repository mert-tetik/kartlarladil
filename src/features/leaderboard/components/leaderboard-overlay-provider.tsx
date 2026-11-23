"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { LeaderboardPageClient } from "@/features/leaderboard/components/leaderboard-page-client";
import type { LeaderboardMode } from "@/features/leaderboard/leaderboard-types";
import {
  setMobileNavbarBackOverride,
  subscribeMobileNavbarBackRequest,
} from "@/components/mobile-navbar-back";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

const LEADERBOARD_OVERLAY_ANIMATION_MS = 320;

type OverlayPhase = "closed" | "opening" | "open" | "closing";

interface LeaderboardOverlayContextValue {
  openLeaderboard: (mode?: LeaderboardMode) => void;
  closeLeaderboard: () => void;
}

const LeaderboardOverlayContext = createContext<LeaderboardOverlayContextValue | null>(null);

export function LeaderboardOverlayProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<OverlayPhase>("closed");
  const [initialMode, setInitialMode] = useState<LeaderboardMode>("points");
  const [showLearnOverlayNavbar, setShowLearnOverlayNavbar] = useState(false);

  const openLeaderboard = useCallback((mode: LeaderboardMode = "points") => {
    const openedFromMotivation =
      pathname === "/learn" &&
      typeof document !== "undefined" &&
      document.querySelector("[data-quiz-continuation-motivation]") !== null;
    setShowLearnOverlayNavbar(openedFromMotivation);
    if (openedFromMotivation) document.documentElement.dataset.learnLeaderboardOverlayOpen = "true";
    else delete document.documentElement.dataset.learnLeaderboardOverlayOpen;
    setInitialMode(mode);
    setPhase((current) => (current === "closed" || current === "closing" ? "opening" : current));
  }, [pathname]);

  const closeLeaderboard = useCallback(() => {
    delete document.documentElement.dataset.learnLeaderboardOverlayOpen;
    setShowLearnOverlayNavbar(false);
    setPhase((current) => (current === "open" || current === "opening" ? "closing" : current));
  }, []);

  useEffect(() => subscribeMobileNavbarBackRequest(closeLeaderboard), [closeLeaderboard]);

  useEffect(() => {
    if (
      showLearnOverlayNavbar &&
      (phase === "opening" || phase === "open") &&
      pathname === "/learn"
    ) {
      document.documentElement.dataset.learnLeaderboardOverlayOpen = "true";
      return;
    }

    delete document.documentElement.dataset.learnLeaderboardOverlayOpen;
  }, [pathname, phase, showLearnOverlayNavbar]);

  useEffect(() => {
    if (phase !== "opening") return;

    const frameId = window.requestAnimationFrame(() => setPhase("open"));
    return () => window.cancelAnimationFrame(frameId);
  }, [phase]);

  useEffect(() => {
    if (phase !== "closing") return;

    const timer = window.setTimeout(() => setPhase("closed"), LEADERBOARD_OVERLAY_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    const visible = phase !== "closed";
    setMobileNavbarBackOverride(visible);

    if (!visible) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "closed") return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeLeaderboard();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeLeaderboard, phase]);

  const contextValue = useMemo(
    () => ({ openLeaderboard, closeLeaderboard }),
    [closeLeaderboard, openLeaderboard],
  );

  return (
    <LeaderboardOverlayContext.Provider value={contextValue}>
      {children}
      {phase !== "closed" && typeof document !== "undefined"
        ? createPortal(
            <LeaderboardOverlay
              phase={phase}
              initialMode={initialMode}
              onClose={closeLeaderboard}
            />,
            document.body,
          )
        : null}
    </LeaderboardOverlayContext.Provider>
  );
}

export function useLeaderboardOverlay() {
  const context = useContext(LeaderboardOverlayContext);
  return context ?? {
    openLeaderboard: () => undefined,
    closeLeaderboard: () => undefined,
  };
}

function LeaderboardOverlay({
  phase,
  initialMode,
  onClose,
}: {
  phase: Exclude<OverlayPhase, "closed">;
  initialMode: LeaderboardMode;
  onClose: () => void;
}) {
  const t = useT();
  const isOpen = phase === "open";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("leaderboard.title")}
      data-leaderboard-overlay
      data-state={phase}
      className={cn(
        "fixed inset-x-0 bottom-0 top-16 z-[80] overflow-hidden transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        isOpen ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
      )}
    >
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={onClose}
        className="absolute inset-0 z-0 w-full bg-black/70"
      />
      <div className="relative z-10 h-full w-full">
        <LeaderboardPageClient key={initialMode} initialMode={initialMode} />
      </div>
    </div>
  );
}
