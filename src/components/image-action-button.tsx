"use client";

import Image from "next/image";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const RESULT_BUTTON_IMAGES = {
  leaderboard: "/result-buttons/leaderboard_button.png",
  menu: "/result-buttons/menu_button.png",
  play: "/result-buttons/play_button.png",
  replay: "/result-buttons/replay_button.png",
} as const;

interface ImageActionButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  imageSrc: string;
  imageSizes?: string;
}

export function ImageActionButton({
  imageSrc,
  imageSizes = "80px",
  className,
  ...props
}: ImageActionButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "relative inline-flex aspect-square shrink-0 items-center justify-center transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
        className,
      )}
      type="button"
    >
      <Image
        src={imageSrc}
        alt=""
        fill
        sizes={imageSizes}
        className="object-contain"
        aria-hidden="true"
      />
    </button>
  );
}
