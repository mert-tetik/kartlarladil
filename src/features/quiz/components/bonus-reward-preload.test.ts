import { afterEach, describe, expect, it, vi } from "vitest";
import { preloadBonusRewardImage } from "@/features/quiz/components/bonus-question-view";

describe("bonus reward media preload", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requests and marks the reward image for asynchronous decoding before the bonus view mounts", () => {
    const image = document.createElement("img");
    function MockImage(this: HTMLImageElement) {
      return image;
    }
    const imageConstructor = vi.spyOn(window, "Image").mockImplementation(
      MockImage as unknown as typeof Image,
    );

    preloadBonusRewardImage();

    expect(imageConstructor).toHaveBeenCalledOnce();
    expect(image.src).toContain("/quiz/bonus_img.png?v=20261001-1");
    expect(image.decoding).toBe("async");
  });
});
