"use client";

import Image from "next/image";
import type { CSSProperties, Ref } from "react";
import { cn } from "@/lib/utils";
import { CHEST_TIER_ARTWORK, type ChestTier } from "@/features/quiz/chest-rewards";

interface ChestArtworkProps {
  tier: ChestTier;
  className?: string;
  lidClassName?: string;
  bodyClassName?: string;
  lidStyle?: CSSProperties;
  lidRef?: Ref<HTMLImageElement>;
  /** Kept for call-site compatibility; the new artwork is a single composed image. */
  hideLid?: boolean;
  priority?: boolean;
  sizes?: string;
}

export function ChestArtwork({
  tier,
  className,
  lidClassName,
  bodyClassName,
  lidStyle,
  lidRef,
  priority = false,
  sizes = "256px",
}: ChestArtworkProps) {
  const artwork = CHEST_TIER_ARTWORK[tier];

  return (
    <div className={cn("relative aspect-square", className)} aria-hidden="true">
      <Image
        ref={lidRef}
        src={artwork}
        alt=""
        fill
        priority={priority}
        sizes={sizes}
        className={cn("pointer-events-none object-contain", bodyClassName, lidClassName)}
        style={lidStyle}
        data-chest-artwork
        data-chest-icon-lid
      />
    </div>
  );
}
