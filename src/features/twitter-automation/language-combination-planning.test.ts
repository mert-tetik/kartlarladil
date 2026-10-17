import { describe, expect, it } from "vitest";
import { buildLanguageCombinationPlan, languageCombinationTargetIds, type LanguageCombinationPlanningRow } from "./language-combination-planning";

const row: LanguageCombinationPlanningRow = {
  contentType: "random" as const,
  contentTypes: ["text", "image", "video"] as const,
  quantity: 1,
  dailyQuantities: { text: 3, image: 2, video: 1 },
  accounts: { instagram: ["1"], youtube: ["2"], x: ["3"] },
  accountContentTypes: {
    "1": ["text", "image"] as const,
    "2": ["image", "video"] as const,
    "3": ["text"] as const,
  },
};

describe("language combination planning", () => {
  it("creates one pool per content type and targets only accounts that selected it", () => {
    const plan = buildLanguageCombinationPlan([{ group: "tr-en", row }]);

    expect(plan).toEqual([
      expect.objectContaining({ contentType: "text", quantity: 3, targetIds: ["1", "3"] }),
      expect.objectContaining({ contentType: "image", quantity: 2, targetIds: ["1", "2"] }),
      expect.objectContaining({ contentType: "video", quantity: 1, targetIds: ["2"] }),
    ]);
  });

  it("does not create a pool when no account selected the content type", () => {
    const noVideo: LanguageCombinationPlanningRow = { ...row, dailyQuantities: { text: 3, image: 2, video: 1 }, accountContentTypes: { "1": ["text"], "2": ["image"], "3": ["text"] } };
    const plan = buildLanguageCombinationPlan([{ group: "tr-en", row: noVideo }]);

    expect(plan.map((item) => item.contentType)).toEqual(["text", "image"]);
    expect(languageCombinationTargetIds(noVideo, "video")).toEqual([]);
  });

  it("keeps different language combination rows separate", () => {
    const plan = buildLanguageCombinationPlan([
      { group: "tr-en", row },
      { group: "es-en", row: { ...row, accounts: { facebook: ["4"] }, accountContentTypes: { "4": ["text"] }, dailyQuantities: { text: 1, image: 0, video: 0 } } satisfies LanguageCombinationPlanningRow },
    ]);

    expect(plan).toHaveLength(4);
    expect(plan[3]).toMatchObject({ group: "es-en", contentType: "text", quantity: 1, targetIds: ["4"] });
  });

  it("keeps legacy quantity semantics when daily quantities are absent", () => {
    const legacyRow: LanguageCombinationPlanningRow = {
      contentType: "random",
      contentTypes: ["text", "image"],
      quantity: 2,
      accounts: { instagram: ["1"], facebook: ["2"] },
    };

    expect(buildLanguageCombinationPlan([{ group: "legacy", row: legacyRow }])).toEqual([
      expect.objectContaining({ contentType: "text", quantity: 2, targetIds: ["1", "2"] }),
      expect.objectContaining({ contentType: "image", quantity: 2, targetIds: ["1", "2"] }),
    ]);
  });
});
