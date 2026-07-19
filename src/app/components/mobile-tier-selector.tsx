"use client";

import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useEffectEvent } from "react";
import { TIERS, TIER_STYLES } from "@/data/tiers";
import {
  setMobileNavbarBackOverride,
  subscribeMobileNavbarBackRequest,
} from "@/components/mobile-navbar-back";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { requestRouteTransition } from "@/lib/route-transition";
import { useIsClient } from "@/lib/use-is-client";
import { vibrate } from "@/lib/vibration";
import type { CardDrawTierFilter } from "@/features/cards/card-draw-preferences";
import type { LanguageCode } from "@/types/domain";

interface MobileTierSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  language: LanguageCode;
}

export function MobileTierSelector({ isOpen, onClose, language }: MobileTierSelectorProps) {
  const router = useRouter();
  const t = useT();
  const mounted = useIsClient();
  const handleNavbarBack = useEffectEvent(() => onClose());

  useEffect(() => {
    if (!isOpen) return;

    setMobileNavbarBackOverride(true);
    const unsubscribe = subscribeMobileNavbarBackRequest(() => handleNavbarBack());

    return () => {
      unsubscribe();
      setMobileNavbarBackOverride(false);
    };
  }, [isOpen]);

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

  function handleSelect(tier: CardDrawTierFilter) {
    vibrate("tap");
    const nextHref = `/card-draw?language=${encodeURIComponent(language)}&tier=${encodeURIComponent(tier)}`;
    onClose();
    requestRouteTransition();
    router.push(nextHref);
  }

  const content = (
    <div
      data-mobile-tier-selector
      className={cn(
        "fixed inset-x-0 top-[var(--app-header-height)] bottom-[var(--mobile-nav-bar-height)] z-30 flex flex-col bg-background transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none lg:hidden",
        isOpen
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
      )}
      aria-hidden={!isOpen}
      inert={!isOpen}
      role="dialog"
      aria-modal={isOpen}
    >
      <div className="flex shrink-0 items-center justify-center border-b border-border bg-background-card px-4 py-4">
        <h2 className="text-center text-lg font-semibold text-foreground">
          {t("home.mobile.selectTierTitle")}
        </h2>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-4 overflow-y-auto p-6">
        {TIERS.map((tier) => {
          const style = TIER_STYLES[tier];

          return (
            <button
              key={tier}
              type="button"
              data-tutorial-target={tier === "A1" ? "tier-choice" : undefined}
              onClick={() => handleSelect(tier)}
              className={cn(
                "w-full rounded-2xl py-5 text-center text-xl font-bold text-white shadow-sm transition-transform active:scale-[0.98]",
                style.accent,
              )}
            >
              {tier}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => handleSelect("all")}
          className="w-full rounded-2xl bg-white py-5 text-center text-xl font-bold text-black shadow-sm transition-transform hover:bg-white/90 active:scale-[0.98]"
        >
          {t("common.all")}
        </button>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
