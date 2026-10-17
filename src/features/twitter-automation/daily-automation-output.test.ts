import { describe, expect, it } from "vitest";
import {
  createDailyAutomationOutputIdentity,
  createDailyAutomationOutputMetadata,
  mergeDailyAutomationOutputMetadata,
  readDailyAutomationOutputMetadata,
} from "./daily-automation-output";

describe("daily automation output identity", () => {
  it("keeps the same slot id when generation is retried", () => {
    const input = {
      ownerKey: "social-studio",
      generationDate: "2026-10-17",
      combinationId: "47c65ced-6664-4cb8-9efd-fbb38de4f158",
      contentType: "image" as const,
      generationIndex: 2,
    };

    expect(createDailyAutomationOutputIdentity(input)).toEqual(
      createDailyAutomationOutputIdentity(input),
    );
  });

  it("separates content types and dates into different slots", () => {
    const base = {
      ownerKey: "social-studio",
      generationDate: "2026-10-17",
      combinationId: "47c65ced-6664-4cb8-9efd-fbb38de4f158",
      generationIndex: 1,
    };

    const text = createDailyAutomationOutputIdentity({ ...base, contentType: "text" });
    const nextDay = createDailyAutomationOutputIdentity({ ...base, contentType: "text", generationDate: "2026-10-18" });
    const image = createDailyAutomationOutputIdentity({ ...base, contentType: "image" });

    expect(new Set([text.id, nextDay.id, image.id]).size).toBe(3);
    expect(new Set([text.generationKey, nextDay.generationKey, image.generationKey]).size).toBe(3);
  });

  it("keeps the daily checkpoint metadata when a renderer replaces its render plan", () => {
    const metadata = {
      generationKey: "foxiesdeck-daily-v1:social-studio:2026-10-17:combo:text:1",
      generationDate: "2026-10-17",
      generationIndex: 1,
      title: "Download FoxiesDeck NOW!",
      description: null,
    };
    const merged = mergeDailyAutomationOutputMetadata({ kind: "browser-image", caption: "Saved caption" }, metadata);

    expect(readDailyAutomationOutputMetadata(merged)).toEqual(metadata);
    expect(merged).toMatchObject({ kind: "browser-image", caption: "Saved caption" });
    expect(createDailyAutomationOutputMetadata(metadata)).toEqual(expect.objectContaining({ __foxiesdeckDailyOutput: metadata }));
  });
});
