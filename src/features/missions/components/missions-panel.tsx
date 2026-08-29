"use client";

import { MissionIcon } from "@/components/mission-icon";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { useT } from "@/i18n/locale-provider";
import { MissionsList } from "./missions-list";

interface MissionsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function MissionsPanel({ open, onClose }: MissionsPanelProps) {
  const t = useT();

  return (
    <MobileBottomSheetShell
      open={open}
      onClose={onClose}
      title={t("missions.title")}
      panelLabel={t("missions.title")}
      visual={<MissionIcon size={52} className="size-[3.25rem]" />}
      contentClassName="overflow-y-auto overscroll-contain px-0 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
    >
      <MissionsList />
    </MobileBottomSheetShell>
  );
}
