import { beforeEach, describe, expect, it, vi } from "vitest";

let beginNavigationIntent: typeof import("./navigation-intent").beginNavigationIntent;
let isActiveNavigationIntent: typeof import("./navigation-intent").isActiveNavigationIntent;

beforeEach(async () => {
  vi.resetModules();
  ({ beginNavigationIntent, isActiveNavigationIntent } = await import("./navigation-intent"));
});

describe("navigation intent", () => {
  it("keeps only the most recent navigation request active", () => {
    const firstIntent = beginNavigationIntent();
    const secondIntent = beginNavigationIntent();

    expect(isActiveNavigationIntent(firstIntent)).toBe(false);
    expect(isActiveNavigationIntent(secondIntent)).toBe(true);
  });
});
