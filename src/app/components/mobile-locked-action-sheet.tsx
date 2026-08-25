"use client";

import Image from "next/image";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

interface MobileLockedActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  variant: "active" | "learned";
  onOpenDraw: () => void;
  onOpenCreate: () => void;
  onStartLearning: () => void;
  canStartLearning: boolean;
}

export function MobileLockedActionSheet({
  isOpen,
  onClose,
  variant,
  onOpenDraw,
  onOpenCreate,
  onStartLearning,
  canStartLearning,
}: MobileLockedActionSheetProps) {
  const t = useT();
  const isActive = variant === "active";

  return (
    <MobileBottomSheetShell
      open={isOpen}
      onClose={onClose}
      title={t(isActive ? "home.mobile.noActiveCardsTitle" : "home.mobile.noLearnedCardsTitle")}
      panelLabel={t(isActive ? "home.mobile.noActiveCardsTitle" : "home.mobile.noLearnedCardsTitle")}
      panelClassName="max-h-[75dvh]"
      visual={<Image src="/mascots/mascot12.webp" alt="" width={128} height={128} className="size-[3.25rem] object-contain" />}
      contentClassName="px-5 pb-5"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        <Image
          src="/mascots/mascot12.webp"
          alt=""
          width={240}
          height={240}
          className="h-40 w-auto object-contain"
        />
        <p className="mt-4 text-sm leading-6 text-brand-foreground/80">
          {t(isActive ? "home.mobile.noActiveCardsDescription" : "home.mobile.noLearnedCardsDescription")}
        </p>
      </div>

      <div className="mt-4 grid gap-2">
        {isActive ? (
          <>
            <div className="mobile-primary-action-depth mobile-primary-action-depth--amber-orange rounded-xl">
              <button
                type="button"
                onClick={onOpenDraw}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-sm font-bold text-white transition-transform active:scale-[0.98]"
              >
                {t("cards.randomDrawTitle")}
              </button>
            </div>
            <div className="mobile-primary-action-depth mobile-primary-action-depth--rose-violet rounded-xl">
              <button
                type="button"
                onClick={onOpenCreate}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-rose-500 to-violet-600 text-sm font-bold text-white transition-transform active:scale-[0.98]"
              >
                {t("home.mobile.addCard")}
              </button>
            </div>
          </>
        ) : (
          <div className={cn(
            "mobile-primary-action-depth mobile-primary-action-depth--emerald rounded-xl",
            !canStartLearning && "mobile-primary-action-depth--locked",
          )}>
            <button
              type="button"
              disabled={!canStartLearning}
              onClick={onStartLearning}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-0 bg-emerald-500 text-base font-bold text-white transition-colors hover:bg-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-emerald-500 disabled:opacity-100"
            >
              <GraduationCap className="size-5" aria-hidden="true" />
              {t("home.mobile.startLearning")}
            </button>
          </div>
        )}
        <div className={cn(
          "mobile-primary-action-depth w-full rounded-md",
          isActive ? "mobile-primary-action-depth--emerald" : "mobile-primary-action-depth--sky",
        )}>
          <Button
            size="lg"
            onClick={onClose}
            className={cn(
              "w-full border-0 text-white",
              isActive ? "bg-emerald-500 hover:bg-emerald-600" : "bg-sky-500 hover:bg-sky-600",
            )}
          >
            {t("common.close")}
          </Button>
        </div>
      </div>
    </MobileBottomSheetShell>
  );
}
