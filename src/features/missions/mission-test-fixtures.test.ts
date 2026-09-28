import { describe, expect, it } from "vitest";
import { createMissionTestViewModels, normalizeMissionTestSeed } from "./mission-test-fixtures";

describe("mission visual test fixtures", () => {
  it("creates a repeatable distribution for the same seed", () => {
    const first = createMissionTestViewModels(123).map((mission) => [mission.missionId, mission.status, mission.progress]);
    const second = createMissionTestViewModels(123).map((mission) => [mission.missionId, mission.status, mission.progress]);

    expect(second).toEqual(first);
  });

  it("changes the distribution for a different seed", () => {
    const first = createMissionTestViewModels(123).map((mission) => mission.status);
    const second = createMissionTestViewModels(456).map((mission) => mission.status);

    expect(second).not.toEqual(first);
  });

  it("always includes claimed, waiting, and locked missions", () => {
    const statuses = new Set(createMissionTestViewModels(123).map((mission) => mission.status));

    expect(statuses).toEqual(new Set(["claimed", "waiting", "locked"]));
  });

  it("uses complete progress for claimed and waiting missions and incomplete progress for locked missions", () => {
    for (const mission of createMissionTestViewModels(123)) {
      if (mission.status === "locked") {
        expect(mission.progress).toBeLessThan(mission.requirement);
      } else {
        expect(mission.progress).toBe(mission.requirement);
      }
    }
  });

  it("normalizes numeric and textual URL seeds", () => {
    expect(normalizeMissionTestSeed("123", 9)).toBe(123);
    expect(normalizeMissionTestSeed("foxies", 9)).toBe(normalizeMissionTestSeed("foxies", 12));
    expect(normalizeMissionTestSeed(undefined, 9)).toBe(9);
  });
});
