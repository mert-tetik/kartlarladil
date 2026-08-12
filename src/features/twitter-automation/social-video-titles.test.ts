import { describe, expect, it } from "vitest";
import { createNativeVisualCaption, finalizeNativeCaption, getNativeCaptionHashtags, getNativeCaptionHeading, getWordOfTheDayTitle, type SocialVisualCaptionKind } from "./social-video-titles";

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

  it("keeps Russian visual captions and headings fully localized", () => {
    const caption = createNativeVisualCaption({
      kind: "miniQuiz",
      learningLanguage: "en",
      nativeLanguage: "ru",
      itemCount: 1,
    });

    expect(caption).toContain("Мини-викторина");
    expect(caption).toContain("1 короткое задание для практики английского");
    expect(caption.match(/#[\p{L}\p{N}_]+/gu)).toHaveLength(5);
  });

  it("uses Russian fixed copy for every social visual and video caption mode", () => {
    const visualKinds: SocialVisualCaptionKind[] = [
      "miniQuiz",
      "falseFriends",
      "dailyChallenge",
      "vocabularyProgression",
      "exampleSentences",
      "vocabularyCarousel",
      "tierProgression",
      "marketingDialogue",
      "everydayDialogue",
      "sentenceCheck",
      "sentenceTranslation",
    ];

    expect(getWordOfTheDayTitle("ru")).toBe("Слово дня");
    expect(getNativeCaptionHeading("ru", "miniQuiz")).toBe("Мини-викторина");

    for (const kind of visualKinds) {
      const caption = createNativeVisualCaption({
        kind,
        learningLanguage: "en",
        nativeLanguage: "ru",
        itemCount: 3,
      });

      expect((caption.match(/[А-Яа-яЁё]/gu) ?? []).length).toBeGreaterThan(20);
      expect(caption.match(/#[\p{L}\p{N}_]+/gu)).toHaveLength(5);
    }
  });

  it("inflects Russian counts and learning-language names naturally", () => {
    expect(createNativeVisualCaption({ kind: "dailyChallenge", learningLanguage: "en", nativeLanguage: "ru", itemCount: 2 }))
      .toContain("2 коротких задания для практики английского");
    expect(createNativeVisualCaption({ kind: "dailyChallenge", learningLanguage: "de", nativeLanguage: "ru", itemCount: 5 }))
      .toContain("5 коротких заданий для практики немецкого");
    expect(createNativeVisualCaption({ kind: "dailyChallenge", learningLanguage: "ja", nativeLanguage: "ru" }))
      .toContain("Продолжай практиковать японский");
  });
});
