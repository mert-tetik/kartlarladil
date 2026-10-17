import { describe, expect, it } from "vitest";
import {
  createFoxiesDeckDownloadCaption,
  createNativeVisualCaption,
  createTitleOnlySocialTitle,
  finalizeNativeCaption,
  getLearningLanguageHashtags,
  getNativeCaptionHeading,
  getWordOfTheDayTitle,
  type SocialVisualCaptionKind,
} from "./social-video-titles";

const LANGUAGE_CODES = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"] as const;

describe("social caption localization", () => {
  it("removes model hashtags and appends the selected learning-language set", () => {
    const caption = finalizeNativeCaption("Learn this today!\n\n#languagelearning #vocabulary", "en");

    expect(caption).toContain("#learnenglish");
    expect(caption).toContain("#englishvocabulary");
    expect(caption).not.toContain("#vocabulary");
    expect(caption.match(/#[\p{L}\p{N}_-]+/gu)).toHaveLength(5);
  });

  it("provides five curated hashtags for every learning language", () => {
    for (const language of LANGUAGE_CODES) {
      const hashtags = getLearningLanguageHashtags(language);
      expect(hashtags).toHaveLength(5);
      expect(hashtags.every((hashtag) => hashtag.startsWith("#"))).toBe(true);
    }
  });

  it("names the target language in both languages and adds culture tags for Japanese and Korean", () => {
    const japanese = getLearningLanguageHashtags("ja", "en");
    const korean = getLearningLanguageHashtags("ko", "en");

    expect(japanese).toEqual(expect.arrayContaining(["#japanese", "#日本語", "#anime", "#アニメ", "#日本語学習"]));
    expect(korean).toEqual(expect.arrayContaining(["#korean", "#한국어", "#kpop", "#bts", "#한국어공부"]));
  });

  it("uses the learning language for fallback captions while keeping native copy", () => {
    const caption = createFoxiesDeckDownloadCaption("tr", "en");

    expect(caption).toContain("FoxiesDeck");
    expect(caption).toContain("#ingilizce");
    expect(caption).toContain("#english");
    expect(caption).toContain("#learnenglish");
    expect(caption).not.toContain("#turkce");
  });

  it("builds a compact title-only fallback with native CTA and learning hashtags", () => {
    const title = createTitleOnlySocialTitle("Mini Quiz\n\n#languagelearning #vocabulary", "tr", "en");

    expect(title).toContain("FoxiesDeck'i şimdi indir!");
    expect(title).toContain("#ingilizce");
    expect(title).toContain("#english");
    expect(title).toContain("#learnenglish");
    expect(title).not.toContain("#vocabulary");
    expect(title.length).toBeLessThanOrEqual(100);
  });

  it("keeps X text captions within the limit with three learning-language hashtags", () => {
    const caption = finalizeNativeCaption("A".repeat(400), "es", { hashtagCount: 3, maxLength: 280 });

    expect(caption.length).toBeLessThanOrEqual(280);
    expect(caption.match(/#[\p{L}\p{N}_-]+/gu)).toHaveLength(3);
  });

  it("uses a native-language summary and learning-language hashtags for visual modes", () => {
    const caption = createNativeVisualCaption({
      kind: "exampleSentences",
      learningLanguage: "en",
      nativeLanguage: "tr",
      itemCount: 3,
    });

    expect(caption).toContain("#ingilizce");
    expect(caption).toContain("#english");
    expect(caption).toContain("#learnenglish");
    expect(caption).not.toContain("#turkce");
    expect(caption.match(/#[\p{L}\p{N}_-]+/gu)).toHaveLength(5);
  });

  it("keeps Russian visual captions and headings fully localized", () => {
    const caption = createNativeVisualCaption({
      kind: "miniQuiz",
      learningLanguage: "en",
      nativeLanguage: "ru",
      itemCount: 1,
    });

    expect(caption).toContain("#английский");
    expect(caption).toContain("#english");
    expect(caption).toContain("#learnenglish");
    expect(caption.match(/#[\p{L}\p{N}_-]+/gu)).toHaveLength(5);
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

    expect(getWordOfTheDayTitle("ru")).toBeTruthy();
    expect(getNativeCaptionHeading("ru", "miniQuiz")).toBeTruthy();

    for (const kind of visualKinds) {
      const caption = createNativeVisualCaption({
        kind,
        learningLanguage: "en",
        nativeLanguage: "ru",
        itemCount: 3,
      });

      expect(caption).toContain("#learnenglish");
      expect(caption.match(/#[\p{L}\p{N}_-]+/gu)).toHaveLength(5);
    }
  });
});
