import { describe, expect, it } from "vitest";
import {
  assertRequiredOfflineMedia,
  REQUIRED_OFFLINE_MEDIA_URLS,
} from "./prepare-hybrid-android.mjs";

describe("offline Android media requirements", () => {
  it("accepts a complete bundle for all language choices and the picker decoration", () => {
    expect(() => assertRequiredOfflineMedia(REQUIRED_OFFLINE_MEDIA_URLS)).not.toThrow();
  });

  it("fails the Android media pack when any picker flag or decoration is absent", () => {
    const incompleteMedia = REQUIRED_OFFLINE_MEDIA_URLS.filter((url) => url !== "/flags/language/ja.png");

    expect(() => assertRequiredOfflineMedia(incompleteMedia))
      .toThrow("/flags/language/ja.png");
  });

  it("requires every tutorial welcome frame in the install-time Android media pack", () => {
    const tutorialFrames = REQUIRED_OFFLINE_MEDIA_URLS.filter(
      (url) => url.startsWith("/mascots/tutorial-welcome/frames/"),
    );
    expect(tutorialFrames).toHaveLength(97);

    const incompleteMedia = REQUIRED_OFFLINE_MEDIA_URLS.filter(
      (url) => url !== "/mascots/tutorial-welcome/frames/frame-048.webp",
    );

    expect(() => assertRequiredOfflineMedia(incompleteMedia))
      .toThrow("/mascots/tutorial-welcome/frames/frame-048.webp");
  });

  it("requires every frame for all six chest opening animations in the install-time Android media pack", () => {
    const chestFrames = REQUIRED_OFFLINE_MEDIA_URLS.filter(
      (url) => url.startsWith("/chests/opening-frames/"),
    );
    expect(chestFrames).toHaveLength(6 * 97);

    const incompleteMedia = REQUIRED_OFFLINE_MEDIA_URLS.filter(
      (url) => url !== "/chests/opening-frames/wood-frames/frame-001.webp",
    );

    expect(() => assertRequiredOfflineMedia(incompleteMedia))
      .toThrow("/chests/opening-frames/wood-frames/frame-001.webp");
  });
});
