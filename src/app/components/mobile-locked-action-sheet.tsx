"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/lib/use-is-client";

interface MobileLockedActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  variant: "active" | "learned";
}

export function MobileLockedActionSheet({ isOpen, onClose, variant }: MobileLockedActionSheetProps) {
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

        <Button size="lg" onClick={onClose} className="mt-4 w-full">
          {t("common.close")}
        </Button>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
