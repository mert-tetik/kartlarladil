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
});
