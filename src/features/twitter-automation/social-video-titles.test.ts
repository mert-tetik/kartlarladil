import { describe, expect, it } from "vitest";
import { createNativeVisualCaption, finalizeNativeCaption, getNativeCaptionHashtags } from "./social-video-titles";

describe("social caption localization", () => {
  it("replaces model hashtags with the selected native-language set", () => {
    expect(finalizeNativeCaption("Bugünkü kelimeyi keşfet!\n\n#languagelearning #vocabulary", "tr"))
      .toBe("Bugünkü kelimeyi keşfet!\n\n#dilöğrenme #kelimeöğrenme #yabancıdil #dilpratiği #kelimehazinesi");
  });

  it("provides a localized hashtag set for every native language", () => {
    expect(getNativeCaptionHashtags("ja")).toEqual(["#語学学習", "#単語", "#外国語", "#語学練習", "#単語学習"]);
  });

  it("uses a native-language summary and exactly five hashtags for visual modes", () => {
    const caption = createNativeVisualCaption({
      kind: "exampleSentences",
      learningLanguage: "en",
      nativeLanguage: "tr",
      itemCount: 3,
    });

    expect(caption).toContain("Örnek Cümleler");
    expect(caption).toContain("İngilizce pratiği");
    expect(caption.match(/#[\p{L}\p{N}_]+/gu)).toHaveLength(5);
  });
});
