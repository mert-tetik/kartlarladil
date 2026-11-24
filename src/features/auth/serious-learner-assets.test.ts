import { afterEach, describe, expect, it } from "vitest";
import {
  preloadSeriousLearnerAssets,
  SERIOUS_LEARNER_FRAME_BASE_PATH,
  SERIOUS_LEARNER_FRAME_COUNT,
  SERIOUS_LEARNER_HERO_PATH,
} from "@/features/auth/serious-learner-assets";

type PendingImage = {
  complete: boolean;
  decoding: string;
  fetchPriority: string;
  onload: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  src: string;
};

const originalImageDescriptor = Object.getOwnPropertyDescriptor(window, "Image");
let pendingImages: PendingImage[] = [];

afterEach(() => {
  if (originalImageDescriptor) {
    Object.defineProperty(window, "Image", originalImageDescriptor);
  } else {
    Reflect.deleteProperty(window, "Image");
  }
  pendingImages = [];
});

describe("Serious Learner asset preloading", () => {
  it("starts the hero and all animation-frame requests together without waiting on them", async () => {
    class MockImage implements PendingImage {
      complete = false;
      decoding = "";
      fetchPriority = "";
      onload: PendingImage["onload"] = null;
      onerror: PendingImage["onerror"] = null;
      src = "";

      constructor() {
        pendingImages.push(this);
      }
    }

    Object.defineProperty(window, "Image", {
      configurable: true,
      writable: true,
      value: MockImage as unknown as typeof Image,
    });

    let settled = false;
    const preload = preloadSeriousLearnerAssets().then(() => {
      settled = true;
    });

    expect(pendingImages).toHaveLength(SERIOUS_LEARNER_FRAME_COUNT + 1);
    expect(pendingImages.map(({ src }) => src)).toEqual([
      SERIOUS_LEARNER_HERO_PATH,
      ...Array.from(
        { length: SERIOUS_LEARNER_FRAME_COUNT },
        (_, index) => `${SERIOUS_LEARNER_FRAME_BASE_PATH}/${index + 1}.webp`,
      ),
    ]);
    expect(pendingImages.every(({ fetchPriority }) => fetchPriority === "low")).toBe(true);
    expect(settled).toBe(false);

    pendingImages.forEach((image) => {
      image.complete = true;
      image.onload?.(new Event("load"));
    });
    await preload;

    expect(settled).toBe(true);
  });
});
