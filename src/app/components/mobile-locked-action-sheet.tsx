"use client";

import { GraduationCap } from "lucide-react";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

interface MobileLockedActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onExited?: () => void;
  variant: "active" | "learned";
  onOpenDraw: () => void;
  onOpenCreate: () => void;
  onStartLearning: () => void;
  canStartLearning: boolean;
}

export function MobileLockedActionSheet({
  isOpen,
  onClose,
  onExited,
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
      onExited={onExited}
      title={t(isActive ? "home.mobile.noActiveCardsTitle" : "home.mobile.noLearnedCardsTitle")}
      panelLabel={t(isActive ? "home.mobile.noActiveCardsTitle" : "home.mobile.noLearnedCardsTitle")}
      panelClassName="min-h-[60dvh] max-h-[85dvh]"
      tone={isActive ? "learn" : "learned"}
      visual={null}
      showProtrusionCircle={false}
      contentClassName="px-5 pb-5"
    >
      <div className="flex shrink-0 flex-col items-center justify-start text-center">
        <p className="text-sm leading-6 text-brand-foreground/80">
          {t(isActive ? "home.mobile.noActiveCardsDescription" : "home.mobile.noLearnedCardsDescription")}
        </p>
      </div>

      <div className="mt-[46px] grid gap-2">
        {isActive ? (
          <>
            <div className="mobile-primary-action-depth mobile-primary-action-depth--amber-orange rounded-xl">
              <button
                type="button"
                onClick={onOpenDraw}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-[var(--reward-start)] to-[var(--reward-end)] text-sm font-bold text-white transition-transform active:scale-[0.98]"
              >
                {t("cards.randomDrawTitle")}
              </button>
            </div>
            <div className="mobile-primary-action-depth mobile-primary-action-depth--rose-violet rounded-xl">
              <button
                type="button"
                onClick={onOpenCreate}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-[var(--action-custom)] to-[var(--accent-quaternary)] text-sm font-bold text-white transition-transform active:scale-[0.98]"
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
              className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-0 bg-action-learn text-base font-bold text-white transition-colors hover:bg-action-learn-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-action-learn disabled:opacity-100"
            >
              <GraduationCap className="size-5" aria-hidden="true" />
              {t("home.mobile.startLearning")}
            </button>
          </div>
        )}
      </div>
    </MobileBottomSheetShell>
  );
}
