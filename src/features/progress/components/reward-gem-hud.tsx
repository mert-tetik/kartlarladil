"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { useOptionalAuthSession } from "@/features/auth/auth-client";
import {
  GEM_ASSETS,
  type GemBalances,
  type GemRewards,
  type GemType,
  getGemBalancesBeforeRewards,
} from "@/features/gems/gem-types";
import { cn } from "@/lib/utils";

export interface GemHudPulse {
  type: GemType;
  key: number;
}

export function useGemRewardDisplay() {
  const [balances, setBalances] = useState<GemBalances | null>(null);
  const [pulse, setPulse] = useState<GemHudPulse | null>(null);
  const pulseKeyRef = useRef(0);

  const prepare = useCallback((finalBalances: GemBalances, rewards: GemRewards | null | undefined) => {
    setBalances(getGemBalancesBeforeRewards(finalBalances, rewards));
  }, []);

  const handleGemArrive = useCallback((type: GemType) => {
    setBalances((current) => current ? { ...current, [type]: current[type] + 1 } : current);
    pulseKeyRef.current += 1;
    setPulse({ type, key: pulseKeyRef.current });
  }, []);

  const finish = useCallback((finalBalances: GemBalances | null | undefined) => {
    if (finalBalances) setBalances(finalBalances);
  }, []);

  return { balances, pulse, prepare, handleGemArrive, finish };
}

export function RewardGemHud({
  className,
  animate = false,
  balances: providedBalances,
  pulse,
}: {
  className?: string;
  animate?: boolean;
  balances?: GemBalances | null;
  pulse?: GemHudPulse | null;
}) {
  const session = useOptionalAuthSession();
  const user = session?.user;
  const profileBalances = {
    blue: user?.profile.blueGems ?? 0,
    green: user?.profile.greenGems ?? 0,
    purple: user?.profile.purpleGems ?? 0,
  } satisfies Record<GemType, number>;
  const balances = providedBalances ?? profileBalances;

  return (
    <div className={cn("flex items-center justify-center gap-1.5 lg:hidden", animate && "animate-points-pop", className)} data-reward-gem-hud>
      {(["blue", "green", "purple"] as const).map((type) => (
        <span
          key={`${type}-${pulse?.type === type ? pulse.key : "idle"}`}
          data-reward-gem-target={type}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full bg-black/30 px-1.5 py-1 text-xs font-bold text-white",
            pulse?.type === type && "animate-gem-target-pulse",
          )}
        >
          <Image src={GEM_ASSETS[type]} alt="" width={20} height={20} className="size-5 object-contain" />
          <span>{balances[type]}</span>
        </span>
      ))}
    </div>
  );
}
