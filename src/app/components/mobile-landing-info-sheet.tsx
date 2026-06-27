"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Sparkles, BookOpen, RotateCcw, X } from "lucide-react";
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
            icon={Sparkles}
            text={t("home.mobile.infoStep1")}
          />
          <InfoRow
            icon={BookOpen}
            text={t("home.mobile.infoStep2")}
          />
          <InfoRow
            icon={RotateCcw}
            text={t("home.mobile.infoStep3")}
          />
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

function InfoRow({ icon: Icon, text }: { icon: typeof Sparkles; text: string }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-background p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <p className="text-sm leading-6 text-foreground-secondary">{text}</p>
    </div>
  );
}
