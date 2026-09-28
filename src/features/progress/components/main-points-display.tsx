"use client";

import type { HTMLAttributes, ReactNode, Ref } from "react";
import { Star } from "lucide-react";
import { MainPointsDisplayBackground } from "@/features/progress/components/main-points-display-background";
import { ScorePulse } from "@/features/progress/components/score-pulse";
import { cn } from "@/lib/utils";

export interface MainPointsDisplayProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children?: ReactNode;
  value: ReactNode;
  pulse?: number | boolean;
  targetRef?: Ref<HTMLSpanElement>;
  icon?: ReactNode;
  groupClassName?: string;
  valueClassName?: string;
  valueDataAttributes?: Partial<Record<`data-${string}`, string>>;
}

/** Shared shell and score-group layout for every animated main-points display. */
export function MainPointsDisplay({
  value,
  pulse = false,
  targetRef,
  icon = <Star className="size-5 fill-current" aria-hidden="true" />,
  className,
  groupClassName,
  valueClassName,
  valueDataAttributes,
  children,
  ...attributes
}: MainPointsDisplayProps) {
  return (
    <div
      {...attributes}
      className={cn(
        "relative flex items-center justify-center rounded-full px-4 py-2 text-white",
        className,
      )}
      data-main-points-display
    >
      <MainPointsDisplayBackground pulse={pulse} />
      <span ref={targetRef} className="relative z-10 inline-flex items-center gap-0">
        <ScorePulse pulse={pulse} className={cn("gap-2", groupClassName)}>
          {icon}
          <span {...valueDataAttributes} className={cn("text-lg font-bold", valueClassName)}>
            {value}
          </span>
        </ScorePulse>
      </span>
      {children}
    </div>
  );
}
