import { afterEach, describe, expect, it, vi } from "vitest";
import { getSpeechLanguage, speakText } from "@/features/cards/card-speech";

describe("card speech", () => {
  afterEach(() => {
    delete window.FoxiesDeckNativeSpeech;
    vi.unstubAllGlobals();
  });

  it("uses the native Android bridge when the app WebView provides it", () => {
    const speak = vi.fn(() => true);
    window.FoxiesDeckNativeSpeech = { speak, stop: vi.fn() };

    expect(speakText("merhaba", "tr", { rate: 0.9 })).toBe(true);
    expect(speak).toHaveBeenCalledWith("merhaba", "tr-TR", 0.9);
  });

  it("maps supported languages to stable BCP-47 speech tags", () => {
    expect(getSpeechLanguage("zh-CN")).toBe("zh-CN");
    expect(getSpeechLanguage("en")).toBe("en-US");
  });
});
