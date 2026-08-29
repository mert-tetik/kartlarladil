"use client";

import { Info } from "lucide-react";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

interface MobileLandingInfoSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileLandingInfoSheet({ isOpen, onClose }: MobileLandingInfoSheetProps) {
  const t = useT();

  return (
    <MobileBottomSheetShell
      open={isOpen}
      onClose={onClose}
      title={t("home.mobile.infoTitle")}
      panelLabel={t("home.mobile.infoTitle")}
      panelClassName="max-h-[75dvh]"
      visual={<Info className="size-[3.25rem] stroke-[2.5] text-brand-foreground" aria-hidden="true" />}
      contentClassName="space-y-4 overflow-y-auto px-5 pb-6"
    >
      <InfoRow step={1} text={t("home.mobile.infoStep1")} />
      <InfoRow step={2} text={t("home.mobile.infoStep2")} />
      <InfoRow step={3} text={t("home.mobile.infoStep3")} />
      <InfoRow step={4} text={t("home.mobile.infoStep4")} />
    </MobileBottomSheetShell>
  );
}

const INFO_STEP_STYLES = {
  1: "bg-action-learn",
  2: "bg-action-learned",
  3: "bg-action-custom",
  4: "bg-gradient-to-r from-[var(--rank-start)] to-[var(--reward-end)]",
} as const;

function InfoRow({ step, text }: { step: 1 | 2 | 3 | 4; text: string }) {
  return (
    <div className={cn("flex items-start gap-4 rounded-xl p-4 shadow-sm", INFO_STEP_STYLES[step])}>
      <span className="shrink-0 font-mono text-2xl font-medium leading-none tracking-tight text-white">{step}</span>
      <p className="text-sm font-medium leading-6 text-white">{text}</p>
    </div>
  );
}
