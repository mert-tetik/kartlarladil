import { describe, expect, it, vi } from "vitest";
import { resolveBrowserMusicVideoSourceUrl } from "./browser-video-source";

describe("browser music video source", () => {
  it("fetches a fresh render source URL for each music-video attempt", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sourceUrl: "https://assets.test/fresh-source.png" }),
    });
    const signal = new AbortController().signal;

    await expect(resolveBrowserMusicVideoSourceUrl({ id: "7d13ccca-d537-4a5a-9a08-20df9c391007", generator: "music-self-mini-quiz" }, "test", signal, fetcher)).resolves.toBe("https://assets.test/fresh-source.png");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/twitter-automation/automation-runs/media-source?outputId=7d13ccca-d537-4a5a-9a08-20df9c391007&scope=test",
      expect.objectContaining({ cache: "no-store", signal }),
    );
  });

  it("preserves the server's safe source error code for the recovery queue", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ errorCode: "browser_video_source_url_failed" }) });

    await expect(resolveBrowserMusicVideoSourceUrl(
      { id: "7d13ccca-d537-4a5a-9a08-20df9c391007", generator: "music-ai-mini-quiz" },
      "production",
      new AbortController().signal,
      fetcher,
    )).rejects.toThrow("browser_video_source_url_failed");
  });
});
