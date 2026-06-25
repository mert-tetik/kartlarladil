"use client";

import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect } from "react";
import { TIERS, TIER_STYLES } from "@/data/tiers";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/lib/use-is-client";
import { vibrate } from "@/lib/vibration";
import type { LanguageCode, Tier } from "@/types/domain";

interface MobileTierSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  language: LanguageCode;
}

export function MobileTierSelector({ isOpen, onClose, language }: MobileTierSelectorProps) {
  const router = useRouter();
  const t = useT();
  const mounted = useIsClient();

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

  function handleSelect(tier: Tier) {
    vibrate("tap");
    onClose();
    router.push(`/card-draw?language=${encodeURIComponent(language)}&tier=${encodeURIComponent(tier)}`);
  }

  const content = (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background transition-opacity duration-300 lg:hidden",
        isOpen ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <div className="flex shrink-0 items-center justify-center border-b border-border bg-background-card px-4 py-4">
        <h2 className="text-center text-lg font-semibold text-foreground">
          {t("home.mobile.selectTierTitle")}
        </h2>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-4 p-6">
        {TIERS.map((tier) => {
          const style = TIER_STYLES[tier];

          return (
            <button
              key={tier}
              type="button"
              onClick={() => handleSelect(tier)}
              className={cn(
                "w-full rounded-2xl py-5 text-center text-xl font-bold text-white shadow-lg transition-transform active:scale-[0.98]",
                style.accent,
              )}
            >
              {tier}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
