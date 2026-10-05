"use client";

import Image from "next/image";
import { useCallback, useRef, useState, type Ref } from "react";
import { useOptionalAuthSession } from "@/features/auth/auth-client";
import { cn } from "@/lib/utils";

export const RESULT_MEDAL_IMAGE_SRC = "/quiz/result-cards/star.png?v=20261003-2";

export interface MedalHudPulse {
  key: number;
}

export function useMedalRewardDisplay() {
  const session = useOptionalAuthSession();
  const pulseKeyRef = useRef(0);
  const [state, setState] = useState(() => ({
    medals: session?.user?.profile.quizResultMedals ?? 0,
    pulse: null as MedalHudPulse | null,
  }));

  const prepare = useCallback((finalMedals: number, rewardMedals: number) => {
    setState({
      medals: Math.max(0, Math.round(finalMedals) - Math.max(0, Math.round(rewardMedals))),
      pulse: null,
    });
  }, []);

  const handleMedalArrive = useCallback((amount = 1) => {
    pulseKeyRef.current += 1;
    setState((current) => ({
      medals: current.medals + amount,
      pulse: { key: pulseKeyRef.current },
    }));
  }, []);

  const finish = useCallback((finalMedals: number | null | undefined) => {
    if (typeof finalMedals === "number") {
      setState((current) => ({ ...current, medals: Math.max(0, Math.round(finalMedals)) }));
    }
  }, []);

  return {
    medals: state.medals,
    pulse: state.pulse,
    prepare,
    handleMedalArrive,
    finish,
  };
}

export function RewardMedalHud({
  className,
  medals: providedMedals,
  pulse,
  targetRef,
  size = "default",
  showBackground = true,
}: {
  className?: string;
  medals?: number | null;
  pulse?: MedalHudPulse | null;
  targetRef?: Ref<HTMLSpanElement>;
  size?: "default" | "large";
  showBackground?: boolean;
}) {
  const session = useOptionalAuthSession();
  const medals = providedMedals ?? session?.user?.profile.quizResultMedals ?? 0;

  return (
    <div
      key={pulse?.key ?? "idle"}
      className={cn(
        "inline-flex items-center justify-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-bold text-white",
        showBackground ? "bg-amber-400/95" : "bg-transparent",
        size === "large" && "gap-1 px-2 py-1.5 text-sm",
        pulse && "animate-gem-target-pulse",
        className,
      )}
      data-main-medals-display
    >
      <span ref={targetRef} className="inline-flex items-center gap-0.5" data-main-medals-target>
        <Image
          src={RESULT_MEDAL_IMAGE_SRC}
          alt=""
          width={size === "large" ? 28 : 20}
          height={size === "large" ? 28 : 20}
          className={cn("size-5 object-contain", size === "large" && "size-7")}
        />
        <span>{medals}</span>
      </span>
    </div>
  );
}
