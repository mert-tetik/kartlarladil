"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GameShellProps {
  children: ReactNode;
  className?: string;
  backgroundSrc?: string;
  backgroundOverlay?: string;
}

export const GAME_BACKGROUND_SOURCES = {
  memory: "/game-backgrounds/red-game-bg.jpg",
  wordChallenge: "/game-backgrounds/green-game-bg.jpg",
  wordMatch: "/game-backgrounds/blue-game-bg.jpg",
  levelComplete: "/game-backgrounds/yellow-game-bg.jpg",
  levelFailed: "/game-backgrounds/dark-game-bg.jpg",
} as const;

export function GameShell({ children, className, backgroundSrc, backgroundOverlay = "rgb(15 23 42 / 0.18)" }: GameShellProps) {
  return (
    <div
      data-games-active
      className={cn(
        "relative flex h-[calc(100dvh-var(--app-header-height)-var(--mobile-nav-bar-height))] flex-col overflow-hidden bg-background lg:h-[calc(100dvh-var(--app-header-height))]",
        className,
      )}
      style={backgroundSrc ? {
        backgroundImage: `linear-gradient(${backgroundOverlay}, ${backgroundOverlay}), url(${backgroundSrc})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      } : undefined}
    >
      {children}
    </div>
  );
}
