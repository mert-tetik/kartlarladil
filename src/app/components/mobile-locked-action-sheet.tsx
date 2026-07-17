"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { GraduationCap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/lib/use-is-client";

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
  const mounted = useIsClient();
  const isActive = variant === "active";

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const content = (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col justify-end transition-opacity duration-300 lg:hidden",
        isOpen ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!isOpen}
      inert={!isOpen}
      role="dialog"
      aria-modal={isOpen}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative flex max-h-[75dvh] flex-col rounded-t-2xl bg-background-card p-5 shadow-2xl transition-transform duration-300",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {t(isActive ? "home.mobile.noActiveCardsTitle" : "home.mobile.noLearnedCardsTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="inline-flex size-9 items-center justify-center rounded-full text-foreground-secondary transition-colors hover:bg-background-muted hover:text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mascots/mascot12.png"
            alt=""
            className="h-40 w-auto object-contain"
          />
          <p className="mt-4 text-sm leading-6 text-foreground-secondary">
            {t(isActive ? "home.mobile.noActiveCardsDescription" : "home.mobile.noLearnedCardsDescription")}
          </p>
        </div>

        <div className="mt-4 grid gap-2">
          {isActive ? (
            <>
              <button
                type="button"
                onClick={onOpenDraw}
                className="h-12 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-sm font-bold text-white transition-transform active:scale-[0.98]"
              >
                {t("cards.randomDrawTitle")}
              </button>
              <button
                type="button"
                onClick={onOpenCreate}
                className="h-12 rounded-xl bg-gradient-to-r from-rose-500 to-violet-600 text-sm font-bold text-white transition-transform active:scale-[0.98]"
              >
                {t("home.mobile.addCard")}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={!canStartLearning}
              onClick={onStartLearning}
              className={cn(
                "flex h-14 w-full items-center justify-center gap-2 rounded-xl border-0 bg-emerald-500 text-base font-bold text-white shadow-lg transition-colors hover:bg-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <GraduationCap className="size-5" aria-hidden="true" />
              {t("home.mobile.startLearning")}
            </button>
          )}
          <Button size="lg" onClick={onClose} className="w-full">
            {t("common.close")}
          </Button>
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
