import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BONUS_REWARD_IMAGE,
  preloadBonusRewardImage,
} from "@/features/quiz/bonus-reward-media";

describe("bonus reward media preload", () => {
  let releasePreload: (() => void) | undefined;

  afterEach(() => {
    releasePreload?.();
    releasePreload = undefined;
    vi.restoreAllMocks();
  });

  it("requests and marks the reward image for asynchronous decoding before the bonus view mounts", () => {
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

    releasePreload = preloadBonusRewardImage();

    expect(imageConstructor).toHaveBeenCalledTimes(5);
    expect(images[0]?.src).toContain(BONUS_REWARD_IMAGE);
    expect(images[0]?.decoding).toBe("async");
    expect(images[0]?.loading).toBe("eager");
    expect(images[0]?.decode).toHaveBeenCalledOnce();
  });
});
