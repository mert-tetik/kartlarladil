"use client";

import { cn } from "@/lib/utils";
import { ChestArtwork } from "@/features/quiz/components/chest-artwork";
import type { ChestTier } from "@/features/quiz/chest-rewards";

interface ChestIconProps {
  tier: ChestTier;
  className?: string;
  hideLid?: boolean;
  artworkSrc?: string;
  unoptimized?: boolean;
  priority?: boolean;
  sizes?: string;
}

export function ChestIcon({
  tier,
  className,
  hideLid = false,
  artworkSrc,
  unoptimized = false,
  priority = false,
  sizes = "56px",
}: ChestIconProps) {
  return (
    <ChestArtwork
      tier={tier}
      className={cn("size-14", className)}
      hideLid={hideLid}
      artworkSrc={artworkSrc}
      unoptimized={unoptimized}
      priority={priority}
      sizes={sizes}
    />
  );
}
