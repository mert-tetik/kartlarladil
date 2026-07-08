"use client";

import { cn } from "@/lib/utils";
import { CHEST_TIER_UI_CLASSES, type ChestTier } from "@/features/quiz/chest-rewards";

interface ChestIconProps {
  tier: ChestTier;
  className?: string;
  hideLid?: boolean;
}

export function ChestIcon({ tier, className, hideLid = false }: ChestIconProps) {
  const ui = CHEST_TIER_UI_CLASSES[tier];

  return (
    <div
      className={cn("relative flex size-14 items-center justify-center overflow-hidden", className)}
      aria-hidden="true"
    >
      <div
        className="flex origin-center items-center justify-center"
        style={{ width: 160, height: 160, transform: "scale(0.28)" }}
      >
        <div className="relative h-[160px] w-[160px]">
          <div
            className={cn(
              "absolute bottom-0 left-[6px] right-[6px] h-[98px] rounded-b-[14px] rounded-t-[10px] border-[3px] border-black/15 shadow-sm",
              ui.base,
            )}
          >
            <div className="absolute inset-x-0 top-0 h-3 bg-black/10" />
            <div className={cn("absolute left-1/2 top-0 h-full w-8 -translate-x-1/2 opacity-80", ui.band)} />
            <div className={cn("absolute left-[24%] top-0 h-full w-4 -translate-x-1/2 opacity-65", ui.band)} />
            <div className={cn("absolute left-[76%] top-0 h-full w-4 -translate-x-1/2 opacity-65", ui.band)} />
          </div>

          {!hideLid ? (
            <div
              data-chest-icon-lid
              className={cn(
                "absolute left-[6px] right-[6px] top-0 z-30 h-[52px] rounded-b-[8px] rounded-t-[16px] border-[3px] border-black/15 shadow-sm",
                ui.lid,
              )}
            >
              <div className="absolute inset-x-0 bottom-0 h-2 bg-black/12" />
              <div className={cn("absolute left-1/2 top-0 h-full w-8 -translate-x-1/2 opacity-80", ui.band)} />
              <div className={cn("absolute left-[24%] top-0 h-full w-4 -translate-x-1/2 opacity-65", ui.band)} />
              <div className={cn("absolute left-[76%] top-0 h-full w-4 -translate-x-1/2 opacity-65", ui.band)} />
              <div
                className={cn(
                  "absolute left-1/2 bottom-0 z-20 h-10 w-10 -translate-x-1/2 translate-y-1/3 rounded-full border-[3px] border-black/15 shadow-sm",
                  ui.lock,
                )}
              >
                <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/30" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
