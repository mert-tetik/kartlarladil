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
  hideLid = false,
  priority = false,
  sizes = "256px",
}: ChestArtworkProps) {
  const artwork = CHEST_TIER_ARTWORK[tier];

  return (
    <div className={cn("relative aspect-square", className)} aria-hidden="true">
      <Image
        src={artwork.bottom}
        alt=""
        fill
        priority={priority}
        sizes={sizes}
        className={cn("pointer-events-none object-contain", bodyClassName)}
        data-chest-artwork-bottom
      />
      {!hideLid ? (
        <Image
          ref={lidRef}
          src={artwork.top}
          alt=""
          fill
          priority={priority}
          sizes={sizes}
          className={cn("pointer-events-none object-contain", lidClassName)}
          style={lidStyle}
          data-chest-artwork-top
          data-chest-icon-lid
        />
      ) : null}
    </div>
  );
}
