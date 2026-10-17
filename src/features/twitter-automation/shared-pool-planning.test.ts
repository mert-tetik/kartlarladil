import { describe, expect, it } from "vitest";
import { buildSharedPoolPlan } from "./shared-pool-planning";

const recipe = (quantity: number, language = "en") => ({
  generator: "fun-post",
  contentType: "text" as const,
  contentTypes: ["text" as const],
  generators: { text: "fun-post" },
  randomIncludes: { text: ["ai"] },
  quantity,
  language,
  nativeLanguage: "tr",
  tier: "B1",
  scheduleStart: "11:00",
  scheduleEnd: "23:00",
});

describe("shared content pool planning", () => {
  it("merges matching platform recipes and preserves each platform quantity", () => {
    const plan = buildSharedPoolPlan([
      { group: "Instagram", row: recipe(3), targetIds: [1] },
      { group: "YouTube", row: recipe(2), targetIds: [2] },
    ]);

    expect(plan).toHaveLength(1);
    expect(plan[0]?.row.quantity).toBe(3);
    expect(plan[0]?.targetIdsByOutput).toEqual([[1, 2], [1, 2], [1]]);
  });

  it("keeps different recipes in separate pools", () => {
    const plan = buildSharedPoolPlan([
      { group: "Instagram", row: recipe(2, "en"), targetIds: [1] },
      { group: "TikTok", row: recipe(2, "ja"), targetIds: [2] },
    ]);

    expect(plan).toHaveLength(2);
    expect(plan.reduce((total, item) => total + item.row.quantity, 0)).toBe(4);
  });
});
