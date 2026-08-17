import { afterEach, describe, expect, it, vi } from "vitest";
import { getOrCreateBrowserVideoPlan, prepareBrowserVideoPlan, type BrowserVideoPlanOutput } from "./browser-video-plan";

const baseOutput: BrowserVideoPlanOutput = {
  id: "7d13ccca-d537-4a5a-9a08-20df9c391007",
  generator: "marketing-dialogue-video",
  language: "en",
  native_language: "tr",
  tier: "A1",
  mediaUrl: null,
};

describe("browser video plans", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prepares a GPT video plan once and reuses it for every local render attempt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        caption: "Test caption",
        backgroundVideoUrl: "https://assets.test/background.mp4",
        firstCharacter: "mascot1",
        secondCharacter: "mascot2",
        scenes: [{}],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const cache = new Map();
    const signal = new AbortController().signal;

    const first = await getOrCreateBrowserVideoPlan(cache, baseOutput, signal);
    const second = await getOrCreateBrowserVideoPlan(cache, baseOutput, signal);

    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/twitter-automation/dialogue-video", expect.objectContaining({ method: "POST", signal }));
  });

  it.each([
    ["confused-words-video", "/api/twitter-automation/confused-words-video", "confused_words_provider_error"],
    ["marketing-dialogue-video", "/api/twitter-automation/dialogue-video", "dialogue_provider_error"],
    ["tier-progression-video", "/api/twitter-automation/original-mascot-learning-video", "original_provider_error"],
  ])("keeps the %s plan endpoint error code without starting a browser render", async (generator, endpoint, errorCode) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ errorCode }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(prepareBrowserVideoPlan({ ...baseOutput, generator }, new AbortController().signal)).rejects.toThrow(errorCode);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(endpoint, expect.objectContaining({ method: "POST" }));
  });
});
