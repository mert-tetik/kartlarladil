"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GameShellProps {
  children: ReactNode;
  className?: string;
  backgroundSrc?: string;
  backgroundOverlay?: string;
  exitButtonVisible?: boolean;
}

export const GAME_BACKGROUND_SOURCES = {
  memory: "/game-backgrounds/games-page-colorful-shapes.png",
  wordChallenge: "/game-backgrounds/dogru-yanlis.png",
  wordMatch: "/game-backgrounds/kelime-eslestirme.png",
  levelComplete: "/game-backgrounds/yellow-game-bg.png",
  levelFailed: "/game-backgrounds/dark-game-bg.png",
} as const;

export function GameShell({
  children,
  className,
  backgroundSrc,
  backgroundOverlay = "rgb(15 23 42 / 0.18)",
  exitButtonVisible = true,
}: GameShellProps) {
  const router = useRouter();

  return (
    <div
      data-games-active
      data-game-ui-ready
      className={cn(
        "relative flex h-screen flex-col overflow-hidden bg-background",
        className,
      )}
      style={backgroundSrc ? {
        backgroundImage: `linear-gradient(${backgroundOverlay}, ${backgroundOverlay}), url(${backgroundSrc})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      } : undefined}
    >
      {children}
      <button
        type="button"
        aria-label="Exit game"
        aria-hidden={!exitButtonVisible}
        data-game-exit
        tabIndex={exitButtonVisible ? 0 : -1}
        onClick={() => router.push("/games")}
        className={cn(
          "game-exit-button absolute bottom-4 left-4 z-[220] flex size-14 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_6px_14px_rgba(127,29,29,0.45)] hover:bg-red-500 active:scale-90",
          exitButtonVisible ? "game-exit-button--visible" : "game-exit-button--hidden",
        )}
      >
        <LogOut className="size-7 stroke-[3.5]" aria-hidden="true" />
      </button>
    </div>
  );
}
