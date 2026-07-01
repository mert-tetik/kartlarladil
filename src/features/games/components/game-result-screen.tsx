"use client";

import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

interface GameResultScreenProps {
  level: number;
  success: boolean;
  points?: number;
  onPrimary: () => void;
}

export function GameResultScreen({ level, success, points = 0, onPrimary }: GameResultScreenProps) {
  const t = useT();

  return (
    <div className="animate-screen-pop flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-black text-foreground sm:text-4xl">
          {success ? t("games.completed", { level }) : t("games.failed", { level })}
        </h1>
        {success ? (
          <p className="text-lg font-semibold text-foreground-secondary">{t("games.pointsEarned", { points })}</p>
        ) : null}
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={onPrimary}
          className={cn(
            buttonClassName("primary", "lg", "w-full"),
            success ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-red-500 text-white hover:bg-red-600",
          )}
        >
          {success ? t("games.nextLevel") : t("games.tryAgain")}
        </button>

        <Link
          href="/games"
          className={cn(buttonClassName("primary", "lg", "w-full"), "bg-brand text-brand-foreground hover:bg-brand-hover")}
        >
          {t("games.menu")}
        </Link>
      </div>
    </div>
  );
}
