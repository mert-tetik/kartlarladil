"use client";

import { MissionIcon } from "@/components/mission-icon";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { useT } from "@/i18n/locale-provider";
import type { MissionNavigationTarget } from "../mission-navigation";
import { MissionsList } from "./missions-list";
import { MissionTestList } from "./mission-test-list";

interface MissionsPanelProps {
  open: boolean;
  onClose: () => void;
  onExited?: () => void;
  onMissionNavigate?: (target: MissionNavigationTarget) => void;
  testMode?: boolean;
  testSeed?: number;
}

export function MissionsPanel({
  open,
  onClose,
  onExited,
  onMissionNavigate,
  testMode = false,
  testSeed = 1,
}: MissionsPanelProps) {
  const t = useT();

  return (
    <MobileBottomSheetShell
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={t("missions.title")}
      titleClassName="text-5xl"
      panelLabel={t("missions.title")}
      visual={<MissionIcon size={52} className="size-[3.25rem]" />}
      tone="mission"
      contentClassName="overflow-y-auto overscroll-contain px-0 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
    >
      {testMode ? <MissionTestList seed={testSeed} /> : <MissionsList onMissionNavigate={onMissionNavigate} />}
    </MobileBottomSheetShell>
  );
}
