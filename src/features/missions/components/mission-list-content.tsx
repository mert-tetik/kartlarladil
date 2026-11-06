"use client";

import type { MissionNavigationTarget } from "../mission-navigation";
import { MissionsList } from "./missions-list";
import { MissionTestList } from "./mission-test-list";

export interface MissionListContentProps {
  testMode?: boolean;
  testSeed?: number;
  claimableCount?: number;
  claimableFirst?: boolean;
  visible?: boolean;
  redirectWhenSignedOut?: boolean;
  onInitialClaimableAvailabilityResolved?: (hasClaimableMissions: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
  onMissionNavigate?: (target: MissionNavigationTarget) => void;
}

export function MissionListContent({
  testMode = false,
  testSeed = 1,
  claimableCount,
  claimableFirst = false,
  visible = true,
  redirectWhenSignedOut = true,
  onInitialClaimableAvailabilityResolved,
  onPendingChange,
  onMissionNavigate,
}: MissionListContentProps) {
  if (testMode) {
    return (
      <MissionTestList
        seed={testSeed}
        claimableCount={claimableCount}
        claimableFirst={claimableFirst}
        visible={visible}
        onPendingChange={onPendingChange}
      />
    );
  }

  return (
    <MissionsList
      claimableFirst={claimableFirst}
      visible={visible}
      redirectWhenSignedOut={redirectWhenSignedOut}
      onInitialClaimableAvailabilityResolved={onInitialClaimableAvailabilityResolved}
      onPendingChange={onPendingChange}
      onMissionNavigate={onMissionNavigate}
    />
  );
}
