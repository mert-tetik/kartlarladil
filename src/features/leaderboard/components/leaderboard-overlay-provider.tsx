"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LeaderboardPageClient } from "@/features/leaderboard/components/leaderboard-page-client";
import {
  setMobileNavbarBackOverride,
  subscribeMobileNavbarBackRequest,
} from "@/components/mobile-navbar-back";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

const LEADERBOARD_OVERLAY_ANIMATION_MS = 320;

type OverlayPhase = "closed" | "opening" | "open" | "closing";

interface LeaderboardOverlayContextValue {
  openLeaderboard: () => void;
  closeLeaderboard: () => void;
}

const LeaderboardOverlayContext = createContext<LeaderboardOverlayContextValue | null>(null);

export function LeaderboardOverlayProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<OverlayPhase>("closed");

  const openLeaderboard = useCallback(() => {
    setPhase((current) => (current === "closed" || current === "closing" ? "opening" : current));
  }, []);

  const closeLeaderboard = useCallback(() => {
    setPhase((current) => (current === "open" || current === "opening" ? "closing" : current));
  }, []);

  useEffect(() => subscribeMobileNavbarBackRequest(closeLeaderboard), [closeLeaderboard]);

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
            <LeaderboardOverlay phase={phase} onClose={closeLeaderboard} />,
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

function LeaderboardOverlay({ phase, onClose }: { phase: Exclude<OverlayPhase, "closed">; onClose: () => void }) {
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
        "fixed inset-x-0 bottom-0 top-[var(--app-header-height)] z-40 overflow-hidden transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
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
        <LeaderboardPageClient />
      </div>
    </div>
  );
}
