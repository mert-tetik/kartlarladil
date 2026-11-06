"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { prioritizeClaimableMissions } from "./mission-progress";
import type { MissionStatus } from "./mission-types";

interface MissionWithDisplayStatus {
  missionId: string;
  status: MissionStatus;
}

export function useMissionDisplayOrder<T extends MissionWithDisplayStatus>(
  missions: readonly T[],
  {
    enabled,
    visible,
  }: {
    enabled: boolean;
    visible: boolean;
  },
): T[] {
  const [orderedMissionIds, setOrderedMissionIds] = useState<string[] | null>(null);
  const hasCapturedCurrentAppearance = useRef(false);

  useLayoutEffect(() => {
    if (!enabled || !visible) {
      hasCapturedCurrentAppearance.current = false;
      return;
    }

    if (hasCapturedCurrentAppearance.current) return;
    hasCapturedCurrentAppearance.current = true;

    // Snapshot the order at the visibility edge, before this screen paints.
    // Later claim/status updates change cards but must not move their positions.
    setOrderedMissionIds(prioritizeClaimableMissions(missions).map(({ missionId }) => missionId));
  }, [enabled, missions, visible]);

  if (!enabled || !orderedMissionIds) return [...missions];

  const missionsById = new Map(missions.map((mission) => [mission.missionId, mission]));
  return orderedMissionIds.flatMap((missionId) => {
    const mission = missionsById.get(missionId);
    return mission ? [mission] : [];
  });
}
