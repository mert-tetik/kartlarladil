import { describe, expect, it } from "vitest";
import { AUTOMATION_SUPER_GROUP_ICON_IDS, normalizeAutomationSuperGroupIcon } from "@/features/twitter-automation/automation-super-groups";

describe("automation upper groups", () => {
  it("keeps the four supported upper group visuals", () => {
    expect(AUTOMATION_SUPER_GROUP_ICON_IDS).toEqual(["social", "video", "image", "text"]);
  });

  it("falls back to the social media visual for invalid saved values", () => {
    expect(normalizeAutomationSuperGroupIcon("video")).toBe("video");
    expect(normalizeAutomationSuperGroupIcon("unknown")).toBe("social");
  });
});
