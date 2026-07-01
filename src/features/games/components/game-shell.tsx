"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GameShellProps {
  children: ReactNode;
  className?: string;
}

export function GameShell({ children, className }: GameShellProps) {
  return (
    <div
      data-games-active
      className={cn(
        "flex h-[calc(100dvh-var(--app-header-height)-var(--mobile-nav-bar-height))] flex-col overflow-hidden bg-background lg:h-[calc(100dvh-var(--app-header-height))]",
        className,
      )}
    >
      {children}
    </div>
  );
}
