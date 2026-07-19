"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  subscribeToGameLaunch,
  type GameLaunchRequest,
} from "@/features/games/game-launch-transition";

const COVER_DURATION_MS = 280;

export function GameLaunchCover() {
  const router = useRouter();
  const pathname = usePathname();
  const [request, setRequest] = useState<GameLaunchRequest | null>(null);
  const [expanded, setExpanded] = useState(false);
  const navigateTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return subscribeToGameLaunch((nextRequest) => {
      if (navigateTimerRef.current !== null) {
        window.clearTimeout(navigateTimerRef.current);
      }

      setRequest(nextRequest);
      setExpanded(false);

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setExpanded(true));
      });

      navigateTimerRef.current = window.setTimeout(() => {
        router.push(nextRequest.href);
        navigateTimerRef.current = null;
      }, COVER_DURATION_MS);
    });
  }, [router]);

  useEffect(() => {
    if (!request || pathname !== request.href) return;

    const releaseCover = window.setTimeout(() => {
      setRequest(null);
      setExpanded(false);
    }, 80);

    return () => window.clearTimeout(releaseCover);
  }, [pathname, request]);

  useEffect(() => {
    return () => {
      if (navigateTimerRef.current !== null) {
        window.clearTimeout(navigateTimerRef.current);
      }
    };
  }, []);

  if (!request || typeof document === "undefined") {
    return null;
  }

  const origin = `${request.origin.x}px ${request.origin.y}px`;
  const clipPath = expanded
    ? `circle(150vmax at ${origin})`
    : `circle(0px at ${origin})`;

  return createPortal(
    <div
      data-game-launch-cover
      aria-hidden="true"
      className="pointer-events-auto fixed inset-0 z-[270] transition-[clip-path] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{ backgroundColor: request.color, clipPath }}
    />,
    document.body,
  );
}
