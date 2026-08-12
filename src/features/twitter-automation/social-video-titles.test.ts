import { describe, expect, it } from "vitest";
import { finalizeNativeCaption, getNativeCaptionHashtags } from "./social-video-titles";

describe("social caption localization", () => {
  it("replaces model hashtags with the selected native-language set", () => {
    expect(finalizeNativeCaption("Bugünkü kelimeyi keşfet!\n\n#languagelearning #vocabulary", "tr"))
      .toBe("Bugünkü kelimeyi keşfet!\n\n#dilöğrenme #kelimeöğrenme #gününkelimesi");
  });

  it("provides a localized hashtag set for every native language", () => {
    expect(getNativeCaptionHashtags("ja")).toEqual(["#語学学習", "#単語", "#今日の単語"]);
  });
});
