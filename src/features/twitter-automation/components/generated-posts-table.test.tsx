import { render, screen, waitFor } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GeneratedPostsTable } from "./generated-posts-table";
import { stageBrowserVideo } from "@/features/twitter-automation/browser-media-stage";
import { prepareMusicVideoAudio, renderMusicVideo } from "@/features/twitter-automation/music-video-renderer";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />,
}));

vi.mock("@/features/twitter-automation/components/automation-browser-image-renderer", () => ({
  AutomationBrowserImageRenderer: ({ output }: { output: { id: string } }) => <div data-output-id={output.id} data-testid="automation-browser-image-renderer" />,
}));

vi.mock("@/features/twitter-automation/browser-media-stage", () => ({
  stageBrowserImage: vi.fn(),
  stageBrowserVideo: vi.fn(),
}));

vi.mock("@/features/twitter-automation/confused-words-video-renderer", () => ({
  renderConfusedWordsVideo: vi.fn(),
}));

vi.mock("@/features/twitter-automation/dialogue-video-renderer", () => ({
  renderDialogueVideo: vi.fn(),
}));

vi.mock("@/features/twitter-automation/music-video-renderer", () => ({
  prepareMusicVideoAudio: vi.fn(),
  renderMusicVideo: vi.fn(),
}));

vi.mock("@/features/twitter-automation/original-mascot-learning-video-renderer", () => ({
  renderOriginalMascotLearningVideo: vi.fn(),
}));

describe("GeneratedPostsTable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a failed output's error detail on the media preview tooltip", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        outputs: [{
          id: "6d13ccca-d537-4a5a-9a08-20df9c391007",
          day_offset: 1,
          group_name: "Test kampanyası",
          content_type: "image",
          generator: "self-mini-quiz",
          language: "en",
          native_language: "tr",
          tier: "A1",
          scheduled_at: "2026-08-14T10:00:00+03:00",
          status: "failed",
          caption: null,
          mediaUrl: null,
          mediaUrls: [],
          media_type: null,
          error_code: "browser_image_render_failed",
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GeneratedPostsTable onClose={vi.fn()} runId="6d13ccca-d537-4a5a-9a08-20df9c391007" scope="test" />);

    const hint = await screen.findByRole("button", { name: "Üretim hata ayrıntısını göster" });
    const tooltip = screen.getByRole("tooltip");

    expect(tooltip).toHaveTextContent("browser_image_render_failed");
    expect(tooltip).toHaveClass("delay-500", "group-hover:opacity-100");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(hint).toBeVisible();
  });

  it("renders Self images from the deployed browser wait state", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        outputs: [{
          id: "b090f621-90eb-448b-b6d5-6631c1506b62",
          day_offset: 1,
          group_name: "Test kampanyası",
          content_type: "image",
          generator: "self-mini-quiz",
          language: "en",
          native_language: "tr",
          tier: "A1",
          scheduled_at: "2026-08-14T10:00:00+03:00",
          status: "awaiting_browser_video",
          caption: null,
          mediaUrl: null,
          mediaUrls: [],
          media_type: null,
          error_code: null,
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GeneratedPostsTable onClose={vi.fn()} runId="b090f621-90eb-448b-b6d5-6631c1506b62" scope="test" />);

    expect(await screen.findByTestId("automation-browser-image-renderer")).toHaveAttribute("data-output-id", "b090f621-90eb-448b-b6d5-6631c1506b62");
    expect(screen.queryByRole("button", { name: /Devam et ve videoya ses ekle/u })).not.toBeInTheDocument();
  });

  it("automatically renders a browser video without requesting a second click", async () => {
    const pendingOutput = {
      id: "8d13ccca-d537-4a5a-9a08-20df9c391007",
      day_offset: 1,
      group_name: "Test kampanyası",
      content_type: "video",
      generator: "music-ai-word-of-the-day",
      language: "en",
      native_language: "tr",
      tier: "A1",
      scheduled_at: "2026-08-14T10:00:00+03:00",
      status: "awaiting_browser_video",
      caption: null,
      mediaUrl: "https://assets.test/poster.png",
      mediaUrls: [],
      media_type: "image",
      error_code: null,
    } as const;
    const readyOutput = { ...pendingOutput, status: "ready_to_schedule" } as const;
    let loadCount = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      void _init;
      const url = String(input);
      if (url.startsWith("/api/twitter-automation/automation-runs?")) {
        loadCount += 1;
        return { ok: true, json: async () => ({ outputs: [loadCount === 1 ? pendingOutput : readyOutput] }) };
      }
      if (url === "/api/twitter-automation/automation-runs/process") return { ok: true, json: async () => ({ processed: true }) };
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(prepareMusicVideoAudio).mockReset();
    vi.mocked(renderMusicVideo).mockReset();
    vi.mocked(stageBrowserVideo).mockReset();
    vi.mocked(prepareMusicVideoAudio).mockResolvedValue({ state: "closed" } as AudioContext);
    vi.mocked(renderMusicVideo).mockResolvedValue(new Blob(["video"], { type: "video/webm" }));
    vi.mocked(stageBrowserVideo).mockResolvedValue({ path: "automation/8d13ccca-d537-4a5a-9a08-20df9c391007.webm", sourceUrl: "https://assets.test/automation-video.webm", mimeType: "video/webm" });

    render(<GeneratedPostsTable onClose={vi.fn()} runId="8d13ccca-d537-4a5a-9a08-20df9c391007" scope="test" />);

    await waitFor(() => expect(renderMusicVideo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(stageBrowserVideo).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/twitter-automation/automation-runs/process", expect.objectContaining({ method: "POST" }));
    expect(screen.queryByRole("button", { name: /Devam et/u })).not.toBeInTheDocument();
  });

  it("marks a failed browser video and continues to the next queued video", async () => {
    const failedOutput = {
      id: "7d13ccca-d537-4a5a-9a08-20df9c391007",
      day_offset: 1,
      group_name: "Test kampanyası",
      content_type: "video",
      generator: "music-ai-word-of-the-day",
      language: "en",
      native_language: "tr",
      tier: "A1",
      scheduled_at: "2026-08-14T10:00:00+03:00",
      status: "awaiting_browser_video",
      caption: null,
      mediaUrl: "https://assets.test/failed-poster.png",
      mediaUrls: [],
      media_type: "image",
      error_code: null,
    } as const;
    const nextOutput = { ...failedOutput, id: "9d13ccca-d537-4a5a-9a08-20df9c391007", mediaUrl: "https://assets.test/next-poster.png" } as const;
    const failedResult = { ...failedOutput, status: "failed", error_code: "audio_activation_required" } as const;
    const readyResult = { ...nextOutput, status: "ready_to_schedule" } as const;
    let loadCount = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      void _init;
      const url = String(input);
      if (url.startsWith("/api/twitter-automation/automation-runs?")) {
        loadCount += 1;
        const outputs = loadCount === 1
          ? [failedOutput, nextOutput]
          : loadCount === 2
            ? [failedResult, nextOutput]
            : [failedResult, readyResult];
        return { ok: true, json: async () => ({ outputs }) };
      }
      if (url === "/api/twitter-automation/automation-runs/process") return { ok: true, json: async () => ({ processed: true }) };
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(prepareMusicVideoAudio).mockReset();
    vi.mocked(renderMusicVideo).mockReset();
    vi.mocked(stageBrowserVideo).mockReset();
    vi.mocked(prepareMusicVideoAudio)
      .mockRejectedValueOnce(new Error("audio_activation_required"))
      .mockResolvedValueOnce({ state: "closed" } as AudioContext);
    vi.mocked(renderMusicVideo).mockResolvedValue(new Blob(["video"], { type: "video/webm" }));
    vi.mocked(stageBrowserVideo).mockResolvedValue({ path: "automation/9d13ccca-d537-4a5a-9a08-20df9c391007.webm", sourceUrl: "https://assets.test/next-video.webm", mimeType: "video/webm" });

    render(<GeneratedPostsTable onClose={vi.fn()} runId="7d13ccca-d537-4a5a-9a08-20df9c391007" scope="test" />);

    await waitFor(() => expect(renderMusicVideo).toHaveBeenCalledTimes(1));
    const failureCall = fetchMock.mock.calls.find(([input, init]) => String(input) === "/api/twitter-automation/automation-runs/process" && String(init?.body).includes("browserVideoError"));
    expect(failureCall).toBeDefined();
    expect(JSON.parse(String(failureCall?.[1]?.body))).toMatchObject({
      outputId: failedOutput.id,
      browserVideoError: "audio_activation_required",
    });
    expect(stageBrowserVideo).toHaveBeenCalledTimes(1);
  });
});
