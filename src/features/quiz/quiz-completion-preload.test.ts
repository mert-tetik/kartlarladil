import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  preloadQuizCompletionAssets,
  QUIZ_COMPLETION_IMAGE_SOURCES,
} from "@/features/quiz/quiz-completion-preload";

describe("quiz completion image preload", () => {
  afterEach(() => vi.restoreAllMocks());

  it("only preloads images bundled with the app", () => {
    const missingSources = QUIZ_COMPLETION_IMAGE_SOURCES.filter((source) => {
      const relativePath = source.split("?")[0].replace(/^\/+/, "");
      return !existsSync(join(process.cwd(), "public", ...relativePath.split("/")));
    });

    expect(missingSources).toEqual([]);
  });

  it("decodes the complete static image set once and retains it until the final Learn lease releases", () => {
    const images: HTMLImageElement[] = [];
    function MockImage(this: HTMLImageElement) {
      const image = document.createElement("img");
      image.decode = vi.fn().mockResolvedValue(undefined);
      images.push(image);
      return image;
    }
    const imageConstructor = vi.spyOn(window, "Image").mockImplementation(
      MockImage as unknown as typeof Image,
    );

    const releaseFirstLease = preloadQuizCompletionAssets();
    expect(imageConstructor).toHaveBeenCalledTimes(QUIZ_COMPLETION_IMAGE_SOURCES.length);
    expect(images.every((image) => image.decoding === "async" && image.loading === "eager")).toBe(true);
    expect(images.every((image) => vi.mocked(image.decode).mock.calls.length === 1)).toBe(true);

    const requestedSources = new Set(images.map((image) => image.src));
    expect(requestedSources).toContain(new URL("/ranks/rank10.webp", window.location.href).href);
    expect(requestedSources).toContain(new URL("/quiz/result-learned-trophy.webp", window.location.href).href);
    expect(requestedSources).toContain(new URL("/card-groups/internetSocialMedia.webp", window.location.href).href);
    expect(requestedSources).toContain(new URL("/missions/mission-claim-bubble-check-v4.webp", window.location.href).href);

    const releaseSecondLease = preloadQuizCompletionAssets();
    releaseFirstLease();
    expect(imageConstructor).toHaveBeenCalledTimes(QUIZ_COMPLETION_IMAGE_SOURCES.length);

    releaseSecondLease();
    const releaseAfterLearnUnmount = preloadQuizCompletionAssets();
    expect(imageConstructor).toHaveBeenCalledTimes(QUIZ_COMPLETION_IMAGE_SOURCES.length * 2);
    releaseAfterLearnUnmount();
  });
});
