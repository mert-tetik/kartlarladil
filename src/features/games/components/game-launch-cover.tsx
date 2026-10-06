"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  markGameLaunchHandled,
  subscribeToGameLaunch,
  type GameLaunchRequest,
} from "@/features/games/game-launch-transition";
import { getHighestTierForLevel } from "../game-levels";
import { GameLaunchCopy, type GameLaunchStage } from "./game-start-splash";

const COVER_DURATION_MS = 560;
const GAME_LAUNCH_TITLE_DURATION_MS = 1500;
const GAME_LAUNCH_DETAILS_DURATION_MS = 2800;
const GAME_LAUNCH_EXIT_DURATION_MS = 4300;
const GAME_LAUNCH_COVER_EXIT_DURATION_MS = 620;

export function GameLaunchCover() {
  const router = useRouter();
  const pathname = usePathname();
  const [request, setRequest] = useState<GameLaunchRequest | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [stage, setStage] = useState<GameLaunchStage>("title");
  const [sequenceComplete, setSequenceComplete] = useState(false);
  const [closing, setClosing] = useState(false);
  const navigateTimerRef = useRef<number | null>(null);
  const sequenceTimersRef = useRef<number[]>([]);
  const closingRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (navigateTimerRef.current !== null) {
      window.clearTimeout(navigateTimerRef.current);
      navigateTimerRef.current = null;
    }

    sequenceTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    sequenceTimersRef.current = [];
  }, []);

  useEffect(() => {
    return subscribeToGameLaunch((nextRequest) => {
      clearTimers();

      setRequest(nextRequest);
      setExpanded(false);
      setStage("title");
      setSequenceComplete(false);
      setClosing(false);
      closingRef.current = false;

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setExpanded(true));
      });

      navigateTimerRef.current = window.setTimeout(() => {
        markGameLaunchHandled(nextRequest.game);
        router.push(nextRequest.href);
        navigateTimerRef.current = null;
      }, COVER_DURATION_MS);

      sequenceTimersRef.current = [
        window.setTimeout(() => setStage("details"), GAME_LAUNCH_TITLE_DURATION_MS),
        window.setTimeout(() => setStage("start"), GAME_LAUNCH_DETAILS_DURATION_MS),
        window.setTimeout(() => setSequenceComplete(true), GAME_LAUNCH_EXIT_DURATION_MS),
      ];
    });
  }, [clearTimers, router]);

  useEffect(() => {
    if (!request || pathname !== request.href || !sequenceComplete) return;

    let releaseTimer: number | null = null;
    let observer: MutationObserver | null = null;

    const releaseWhenReady = () => {
      if (closingRef.current) return;
      if (!document.querySelector("[data-game-ui-ready]")) return;

      closingRef.current = true;
      setClosing(true);
      releaseTimer = window.setTimeout(() => {
        clearTimers();
        setRequest(null);
        setExpanded(false);
        setSequenceComplete(false);
        setClosing(false);
        closingRef.current = false;
      }, GAME_LAUNCH_COVER_EXIT_DURATION_MS);
      observer?.disconnect();
    };

    releaseWhenReady();
    if (!releaseTimer) {
      observer = new MutationObserver(releaseWhenReady);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      if (releaseTimer !== null) window.clearTimeout(releaseTimer);
      observer?.disconnect();
    };
  }, [clearTimers, pathname, request, sequenceComplete]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  if (!request || typeof document === "undefined") {
    return null;
  }

  const origin = `${request.origin.x}px ${request.origin.y}px`;
  const clipPath = expanded
    ? `circle(150vmax at ${origin})`
    : `circle(0px at ${origin})`;
  const level = request.level ?? 1;
  const tier = request.tier ?? getHighestTierForLevel(level);

  return createPortal(
    <div
      data-game-launch-cover
      aria-hidden="true"
      className="pointer-events-auto fixed inset-0 z-[270] flex items-center justify-center overflow-hidden"
      style={{
        backgroundColor: request.color,
        clipPath,
        transform: closing ? "translate3d(0, 100%, 0)" : "translate3d(0, 0, 0)",
        transition: "clip-path 560ms cubic-bezier(0.22, 1, 0.36, 1), transform 620ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <GameLaunchCopy game={request.game} level={level} tier={tier} stage={stage} />
    </div>,
    document.body,
  );
}
