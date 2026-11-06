import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMissionDisplayOrder } from "./use-mission-display-order";
import type { MissionStatus } from "./mission-types";

interface TestMission {
  missionId: string;
  status: MissionStatus;
}

const INITIAL_MISSIONS: TestMission[] = [
  { missionId: "locked-first", status: "locked" },
  { missionId: "claimed-first", status: "claimed" },
  { missionId: "waiting-first", status: "waiting" },
  { missionId: "locked-second", status: "locked" },
  { missionId: "waiting-second", status: "waiting" },
];

const ids = (missions: readonly TestMission[]) => missions.map(({ missionId }) => missionId);

describe("useMissionDisplayOrder", () => {
  it("sorts when the screen appears once, then keeps claimed missions in place until next appearance", () => {
    const { result, rerender } = renderHook(
      ({ missions, visible }: { missions: TestMission[]; visible: boolean }) => (
        useMissionDisplayOrder(missions, { enabled: true, visible })
      ),
      { initialProps: { missions: INITIAL_MISSIONS, visible: false } },
    );

    expect(ids(result.current)).toEqual(ids(INITIAL_MISSIONS));

    act(() => rerender({ missions: INITIAL_MISSIONS, visible: true }));
    expect(ids(result.current)).toEqual([
      "waiting-first",
      "waiting-second",
      "locked-first",
      "locked-second",
      "claimed-first",
    ]);

    const updatedMissions = INITIAL_MISSIONS.map((mission) => {
      if (mission.missionId === "waiting-first") return { ...mission, status: "claimed" as const };
      if (mission.missionId === "locked-first") return { ...mission, status: "waiting" as const };
      return mission;
    });
    act(() => rerender({ missions: updatedMissions, visible: true }));

    expect(ids(result.current)).toEqual([
      "waiting-first",
      "waiting-second",
      "locked-first",
      "locked-second",
      "claimed-first",
    ]);
    expect(result.current[0]?.status).toBe("claimed");
    expect(result.current[2]?.status).toBe("waiting");

    act(() => rerender({ missions: updatedMissions, visible: false }));
    expect(ids(result.current)).toEqual([
      "waiting-first",
      "waiting-second",
      "locked-first",
      "locked-second",
      "claimed-first",
    ]);

    act(() => rerender({ missions: updatedMissions, visible: true }));

    expect(ids(result.current)).toEqual([
      "locked-first",
      "waiting-second",
      "locked-second",
      "claimed-first",
      "waiting-first",
    ]);
  });
});
