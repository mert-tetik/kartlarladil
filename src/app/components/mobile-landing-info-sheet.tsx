"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/lib/use-is-client";

interface MobileLandingInfoSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileLandingInfoSheet({ isOpen, onClose }: MobileLandingInfoSheetProps) {
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
          <h2 className="text-lg font-semibold text-foreground">{t("home.mobile.infoTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="inline-flex size-9 items-center justify-center rounded-full text-foreground-secondary transition-colors hover:bg-background-muted hover:text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto">
          <InfoRow
            step={1}
            text={t("home.mobile.infoStep1")}
          />
          <InfoRow
            step={2}
            text={t("home.mobile.infoStep2")}
          />
          <InfoRow
            step={3}
            text={t("home.mobile.infoStep3")}
          />
          <InfoRow
            step={4}
            text={t("home.mobile.infoStep4")}
          />
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

const INFO_STEP_STYLES = {
  1: "bg-emerald-500",
  2: "bg-sky-500",
  3: "bg-rose-500",
  4: "bg-gradient-to-r from-amber-400 to-orange-500",
} as const;

function InfoRow({ step, text }: { step: 1 | 2 | 3 | 4; text: string }) {
  return (
    <div className={cn("flex items-start gap-4 rounded-xl p-4 shadow-sm", INFO_STEP_STYLES[step])}>
      <span className="shrink-0 font-mono text-2xl font-medium leading-none tracking-tight text-white">{step}</span>
      <p className="text-sm font-medium leading-6 text-white">{text}</p>
    </div>
  );
}
