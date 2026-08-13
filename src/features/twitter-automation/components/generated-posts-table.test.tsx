import { render, screen, waitFor } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GeneratedPostsTable } from "./generated-posts-table";

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
});
