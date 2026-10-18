import { describe, expect, it } from "vitest";
import { adaptSocialCaptionHashtags, getSocialPostHashtags, usesDorficVisualStyle } from "./social-platform-hashtags";

describe("social platform hashtag policy", () => {
  it("replaces the two lowest-priority language tags with the visual-style tags", () => {
    const hashtags = getSocialPostHashtags({
      platform: "Instagram",
      learningLanguage: "en",
      nativeLanguage: "tr",
      dorficVisual: true,
    });

    expect(hashtags).toHaveLength(5);
    expect(hashtags.slice(-2)).toEqual(["#DORFic", "#FrutigerAero"]);
    expect(hashtags).toContain("#learnenglish");
  });

  it("uses X's two-tag recommendation without exceeding it", () => {
    const hashtags = getSocialPostHashtags({
      platform: "X",
      learningLanguage: "en",
      nativeLanguage: "tr",
      dorficVisual: true,
    });

    expect(hashtags).toEqual(["#DORFic", "#FrutigerAero"]);
  });

  it("keeps platform caps for TikTok and YouTube and avoids generic FYP tags", () => {
    const tiktok = getSocialPostHashtags({ platform: "TikTok", learningLanguage: "en", nativeLanguage: "tr", dorficVisual: true });
    const youtube = getSocialPostHashtags({ platform: "YouTube", learningLanguage: "en", nativeLanguage: "tr", dorficVisual: true });

    expect(tiktok).toHaveLength(5);
    expect(youtube).toHaveLength(3);
    expect(tiktok).not.toContain("#fyp");
    expect(tiktok.slice(-2)).toEqual(["#DORFic", "#FrutigerAero"]);
    expect(youtube.slice(-2)).toEqual(["#DORFic", "#FrutigerAero"]);
  });

  it("omits caption hashtags on Threads and messaging or non-social destinations", () => {
    for (const platform of ["Threads", "Discord", "Telegram", "Slack", "Google Business", "WordPress"]) {
      expect(getSocialPostHashtags({ platform, learningLanguage: "en", nativeLanguage: "tr", dorficVisual: true })).toEqual([]);
    }

    expect(adaptSocialCaptionHashtags({
      caption: "A visual language-learning post.\n\n#oldtag",
      platform: "threads",
      learningLanguage: "en",
      nativeLanguage: "tr",
      dorficVisual: true,
    })).toBe("A visual language-learning post.");
  });

  it("only classifies known AI mascot media as DORFic-styled", () => {
    expect(usesDorficVisualStyle("random-content", { kind: "ai-image", generator: "ai-mini-quiz" })).toBe(true);
    expect(usesDorficVisualStyle("random-content", { kind: "ai-avatar-video" })).toBe(true);
    expect(usesDorficVisualStyle("music-ai-example-sentences")).toBe(true);
    expect(usesDorficVisualStyle("self-mini-quiz")).toBe(false);
    expect(usesDorficVisualStyle("random-content", { kind: "browser-rendered-image" })).toBe(false);
  });

  it("removes prior hashtags before appending the selected platform set", () => {
    const caption = adaptSocialCaptionHashtags({
      caption: "Learn a new word!\n\n#modeltag #fyp",
      platform: "TikTok",
      learningLanguage: "en",
      nativeLanguage: "tr",
      dorficVisual: true,
    });

    expect(caption).toContain("Learn a new word!");
    expect(caption).not.toContain("#modeltag");
    expect(caption).not.toContain("#fyp");
    expect(caption.match(/#[\p{L}\p{N}_-]+/gu)).toHaveLength(5);
  });
});
