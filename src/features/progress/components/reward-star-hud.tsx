"use client";

import Image from "next/image";
import { useCallback, useRef, useState, type Ref } from "react";
import { useOptionalAuthSession } from "@/features/auth/auth-client";
import { cn } from "@/lib/utils";

export const RESULT_STAR_IMAGE_SRC = "/quiz/result-cards/star.png?v=20261003-2";

export interface StarHudPulse {
  key: number;
}

export function useStarRewardDisplay() {
  const session = useOptionalAuthSession();
  const pulseKeyRef = useRef(0);
  const [state, setState] = useState(() => ({
    stars: session?.user?.profile.quizResultStars ?? 0,
    pulse: null as StarHudPulse | null,
  }));

  const prepare = useCallback((finalStars: number, rewardStars: number) => {
    setState({
      stars: Math.max(0, Math.round(finalStars) - Math.max(0, Math.round(rewardStars))),
      pulse: null,
    });
  }, []);

  const handleStarArrive = useCallback((amount = 1) => {
    pulseKeyRef.current += 1;
    setState((current) => ({
      stars: current.stars + amount,
      pulse: { key: pulseKeyRef.current },
    }));
  }, []);

  const finish = useCallback((finalStars: number | null | undefined) => {
    if (typeof finalStars === "number") {
      setState((current) => ({ ...current, stars: Math.max(0, Math.round(finalStars)) }));
    }
  }, []);

  return {
    stars: state.stars,
    pulse: state.pulse,
    prepare,
    handleStarArrive,
    finish,
  };
}

export function RewardStarHud({
  className,
  stars: providedStars,
  pulse,
  targetRef,
  size = "default",
}: {
  className?: string;
  stars?: number | null;
  pulse?: StarHudPulse | null;
  targetRef?: Ref<HTMLSpanElement>;
  size?: "default" | "large";
}) {
  const session = useOptionalAuthSession();
  const stars = providedStars ?? session?.user?.profile.quizResultStars ?? 0;

  return (
    <div
      key={pulse?.key ?? "idle"}
      className={cn(
        "inline-flex items-center justify-center gap-0.5 rounded-md bg-amber-400/95 px-1.5 py-1 text-xs font-bold text-white",
        size === "large" && "gap-1 px-2 py-1.5 text-sm",
        pulse && "animate-gem-target-pulse",
        className,
      )}
      data-main-stars-display
    >
      <span ref={targetRef} className="inline-flex items-center gap-0.5" data-main-stars-target>
        <Image
          src={RESULT_STAR_IMAGE_SRC}
          alt=""
          width={size === "large" ? 28 : 20}
          height={size === "large" ? 28 : 20}
          className={cn("size-5 object-contain", size === "large" && "size-7")}
        />
        <span>{stars}</span>
      </span>
    </div>
  );
}
