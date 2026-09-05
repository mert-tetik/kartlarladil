"use client";

import Image from "next/image";
import { useOptionalAuthSession } from "@/features/auth/auth-client";
import { GEM_ASSETS, type GemType } from "@/features/gems/gem-types";
import { cn } from "@/lib/utils";

export function RewardGemHud({ className, animate = false }: { className?: string; animate?: boolean }) {
  const session = useOptionalAuthSession();
  const user = session?.user;
  const balances = {
    blue: user?.profile.blueGems ?? 0,
    green: user?.profile.greenGems ?? 0,
    purple: user?.profile.purpleGems ?? 0,
  } satisfies Record<GemType, number>;

  return (
    <div className={cn("flex items-center justify-center gap-1.5 lg:hidden", animate && "animate-points-pop", className)} data-reward-gem-hud>
      {(["blue", "green", "purple"] as const).map((type) => (
        <span key={type} data-reward-gem-target={type} className="inline-flex items-center gap-0.5 rounded-full bg-black/30 px-1.5 py-1 text-xs font-bold text-white">
          <Image src={GEM_ASSETS[type]} alt="" width={20} height={20} className="size-5 object-contain" />
          <span>{balances[type]}</span>
        </span>
      ))}
    </div>
  );
}
