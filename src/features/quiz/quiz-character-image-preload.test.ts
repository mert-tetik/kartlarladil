import { afterEach, describe, expect, it, vi } from "vitest";
import { getAiPracticeCharacters } from "@/features/ai-practice/ai-practice-data";
import {
  preloadQuizCharacterImages,
  preloadQuizImageSources,
} from "@/features/quiz/quiz-video-preload";

describe("quiz character image preload", () => {
  afterEach(() => vi.restoreAllMocks());

  it("decodes the exact portrait URLs while Learn holds a lease and releases them afterward", () => {
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

    const expectedSources = getAiPracticeCharacters().map((character) => character.imageSrc);
    const releaseFirstLease = preloadQuizCharacterImages();
    const releaseSecondLease = preloadQuizCharacterImages();
    preloadQuizImageSources(["/card-groups/school.webp", "/card-groups/school.webp"]);

    expect(imageConstructor).toHaveBeenCalledTimes(expectedSources.length + 1);
    expect(images.map((image) => image.src).sort()).toEqual(
      [...expectedSources, "/card-groups/school.webp"]
        .map((source) => new URL(source, window.location.href).href)
        .sort(),
    );
    expect(images.every((image) => image.decoding === "async" && image.loading === "eager")).toBe(true);
    expect(images.every((image) => vi.mocked(image.decode).mock.calls.length === 1)).toBe(true);

    releaseFirstLease();
    const releaseThirdLease = preloadQuizCharacterImages();
    expect(imageConstructor).toHaveBeenCalledTimes(expectedSources.length + 1);

    releaseSecondLease();
    releaseThirdLease();

    const releaseAfterUnmount = preloadQuizCharacterImages();
    expect(imageConstructor).toHaveBeenCalledTimes(expectedSources.length * 2 + 1);
    releaseAfterUnmount();
  });
});
