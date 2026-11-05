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

  it("requires the tutorial welcome atlas in the install-time Android media pack", () => {
    const incompleteMedia = REQUIRED_OFFLINE_MEDIA_URLS.filter(
      (url) => url !== "/video-frame-atlases/tutorial-welcome/atlas-013.webp",
    );

    expect(() => assertRequiredOfflineMedia(incompleteMedia))
      .toThrow("/video-frame-atlases/tutorial-welcome/atlas-013.webp");
  });
});
