import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GeneratedPostsTable } from "./generated-posts-table";
import { stageBrowserImage, stageBrowserVideo } from "@/features/twitter-automation/browser-media-stage";
import { prepareMusicVideoAudio, renderMusicVideo } from "@/features/twitter-automation/music-video-renderer";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />,
}));

vi.mock("@/features/twitter-automation/components/automation-browser-image-renderer", () => ({
  AutomationBrowserImageRenderer: ({ onComplete, onError, output }: { onComplete: (result: { caption: string; imageDataUrls: string[] }) => void; onError: (error: unknown) => void; output: { id: string } }) => <div data-output-id={output.id} data-testid="automation-browser-image-renderer"><button onClick={() => onError(new Error("browser_image_snapshot_failed"))} type="button">Snapshot hatasını bildir</button><button onClick={() => onComplete({ caption: "Test caption", imageDataUrls: ["data:image/png;base64,ok"] })} type="button">Staging hatasını bildir</button></div>,
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
    vi.useRealTimers();
  });

  it("keeps a failed output's error detail on the media preview tooltip", async () => {
    vi.useFakeTimers();
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

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    const hint = screen.getByRole("button", { name: "Üretim hata ayrıntısını göster" });
    const tooltip = screen.getByRole("tooltip");

    expect(tooltip).toHaveTextContent("browser_image_render_failed");
    expect(tooltip).toHaveClass("delay-500", "group-hover:opacity-100");
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    expect(hint).toBeVisible();
  });

  it("persists the specific browser snapshot failure code for recovery instead of the legacy fallback", async () => {
    const pendingOutput = {
      id: "1d13ccca-d537-4a5a-9a08-20df9c391007",
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
    } as const;
    let didReportFailure = false;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url.startsWith("/api/twitter-automation/automation-runs?")) {
        return {
          ok: true,
          json: async () => ({
            outputs: [didReportFailure ? { ...pendingOutput, status: "failed", error_code: "browser_image_snapshot_failed" } : pendingOutput],
          }),
        };
      }
      if (url === "/api/twitter-automation/automation-runs/process") {
        didReportFailure = true;
        return { ok: true, json: async () => ({ processed: true, outcome: "failed" }) };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GeneratedPostsTable onClose={vi.fn()} runId={pendingOutput.id} scope="test" />);

    fireEvent.click(await screen.findByRole("button", { name: "Snapshot hatasını bildir" }));

    await waitFor(() => {
      const failureCall = fetchMock.mock.calls.find(([input, init]) => String(input) === "/api/twitter-automation/automation-runs/process" && String(init?.body).includes("browserImageError"));
      expect(failureCall).toBeDefined();
      expect(JSON.parse(String(failureCall?.[1]?.body))).toMatchObject({
        outputId: pendingOutput.id,
        browserImageError: "browser_image_snapshot_failed",
      });
    });
  });

  it("moves a repeatedly failed image staging upload into the existing recovery queue", async () => {
    const pendingOutput = {
      id: "3d13ccca-d537-4a5a-9a08-20df9c391007",
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
    } as const;
    let didReportFailure = false;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url.startsWith("data:image/png")) return { ok: true, blob: async () => new Blob(["image"], { type: "image/png" }) };
      if (url.startsWith("/api/twitter-automation/automation-runs?")) {
        return { ok: true, json: async () => ({ outputs: [didReportFailure ? { ...pendingOutput, status: "failed", error_code: "browser_image_stage_failed" } : pendingOutput] }) };
      }
      if (url === "/api/twitter-automation/automation-runs/process") {
        didReportFailure = true;
        return { ok: true, json: async () => ({ processed: true, outcome: "failed" }) };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(stageBrowserImage).mockRejectedValue(new Error("media_stage_unavailable"));

    render(<GeneratedPostsTable onClose={vi.fn()} runId={pendingOutput.id} scope="test" />);

    fireEvent.click(await screen.findByRole("button", { name: "Staging hatasını bildir" }));

    await waitFor(() => expect(stageBrowserImage).toHaveBeenCalledTimes(3), { timeout: 3_000 });
    await waitFor(() => {
      const failureCall = fetchMock.mock.calls.find(([input, init]) => String(input) === "/api/twitter-automation/automation-runs/process" && String(init?.body).includes("browserImageError"));
      expect(failureCall).toBeDefined();
      expect(JSON.parse(String(failureCall?.[1]?.body))).toMatchObject({
        outputId: pendingOutput.id,
        browserImageError: "browser_image_stage_failed",
      });
    });
  });

  it("does not report a failed output as ready in the accessible progress bar", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        outputs: [{
          id: "2d13ccca-d537-4a5a-9a08-20df9c391007",
          day_offset: 1,
          group_name: "Test kampanyası",
          content_type: "image",
          generator: "ai-mini-quiz",
          language: "en",
          native_language: "tr",
          tier: "A1",
          scheduled_at: "2026-08-14T10:00:00+03:00",
          status: "failed",
          caption: null,
          mediaUrl: null,
          mediaUrls: [],
          media_type: null,
          error_code: "image_generation_failed",
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GeneratedPostsTable onClose={vi.fn()} runId="2d13ccca-d537-4a5a-9a08-20df9c391007" scope="test" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole("progressbar", { name: "İçerik üretim ilerlemesi" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0 / 1 hazır")).toBeVisible();
  });

  it("moves unverified remaining outputs to a yellow review state after a refresh failure", async () => {
    const pendingOutput = {
      id: "5d13ccca-d537-4a5a-9a08-20df9c391007",
      day_offset: 1,
      group_name: "Test kampanyası",
      content_type: "text",
      generator: "fun-post",
      language: "en",
      native_language: "tr",
      tier: "A1",
      scheduled_at: "2026-08-14T10:00:00+03:00",
      status: "queued",
      caption: null,
      mediaUrl: null,
      mediaUrls: [],
      media_type: null,
      error_code: null,
    } as const;
    let loadCount = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      void _init;
      const url = String(input);
      if (url.startsWith("/api/twitter-automation/automation-runs?")) {
        loadCount += 1;
        return loadCount === 1
          ? { ok: true, json: async () => ({ outputs: [pendingOutput] }) }
          : { ok: false, json: async () => ({ errorCode: "automation_runs_unavailable" }) };
      }
      if (url === "/api/twitter-automation/automation-runs/process") return { ok: true, json: async () => ({ processed: true }) };
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GeneratedPostsTable onClose={vi.fn()} runId="5d13ccca-d537-4a5a-9a08-20df9c391007" scope="test" />);

    const reviewButton = await screen.findByRole("button", { name: "Sonuç ekranına git" });
    expect(screen.getByRole("button", { name: "Devam etmeye çalış (30 sn)" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Otomatik devam denemesini iptal et" }));
    expect(screen.getByRole("button", { name: "Devam etmeye çalış" })).toBeEnabled();
    expect(screen.getAllByText("İçerik üretim akışı yenilenemedi.").length).toBeGreaterThan(0);
    fireEvent.click(reviewButton);

    expect(await screen.findByText("Beklemede")).toBeVisible();
    expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeVisible();
    const statusHint = screen.getByRole("button", { name: "İçerik durumu ayrıntısını göster" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("İçerik üretim akışı yenilenemedi.");
    expect(statusHint).toHaveClass("text-[#f1c75b]");
  });

  it("automatically tries the interrupted flow again after the 30-second cooldown", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ errorCode: "automation_runs_unavailable" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GeneratedPostsTable onClose={vi.fn()} runId="5d13ccca-d537-4a5a-9a08-20df9c391008" scope="test" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole("button", { name: "Devam etmeye çalış (30 sn)" })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the progress screen open and retries again when refresh failures continue", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ errorCode: "automation_runs_unavailable" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GeneratedPostsTable onClose={vi.fn()} runId="5d13ccca-d537-4a5a-9a08-20df9c391010" scope="test" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getAllByText("İçerikler hazırlanıyor")[0]).toBeVisible();
    expect(screen.queryByText("Üretilen içerikler")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Devam etmeye çalış (30 sn)" })).toBeDisabled();
  });

  it("cancels the automatic retry when the cooldown close button is used", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ errorCode: "automation_runs_unavailable" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GeneratedPostsTable onClose={vi.fn()} runId="5d13ccca-d537-4a5a-9a08-20df9c391009" scope="test" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByRole("button", { name: "Otomatik devam denemesini iptal et" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("restores a failed output as successful when its retry returns a ready result", async () => {
    vi.useFakeTimers();
    const failedOutput = {
      id: "4d13ccca-d537-4a5a-9a08-20df9c391007",
      day_offset: 1,
      group_name: "Test kampanyası",
      content_type: "image",
      generator: "ai-mini-quiz",
      language: "en",
      native_language: "tr",
      tier: "A1",
      scheduled_at: "2026-08-14T10:00:00+03:00",
      status: "failed",
      caption: "Hazır açıklama",
      mediaUrl: "https://assets.test/ready.png",
      mediaUrls: [],
      media_type: "image",
      error_code: "automation_schedule_failed",
    } as const;
    let retryCalls = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      void _init;
      const url = String(input);
      if (url.startsWith("/api/twitter-automation/automation-runs?")) return { ok: true, json: async () => ({ outputs: [failedOutput] }) };
      if (url === "/api/twitter-automation/automation-runs/retry") {
        retryCalls += 1;
        return retryCalls <= 2
          ? { ok: false, json: async () => ({ errorCode: "automation_retry_failed" }) }
          : { ok: true, json: async () => ({ outputId: failedOutput.id, status: "ready_to_schedule" }) };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GeneratedPostsTable onClose={vi.fn()} runId="4d13ccca-d537-4a5a-9a08-20df9c391007" scope="test" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yeniden üret" }));
      await Promise.resolve();
    });

    expect(screen.getByText("Başarılı")).toBeVisible();
    const retryCall = fetchMock.mock.calls.find(([input]) => String(input) === "/api/twitter-automation/automation-runs/retry");
    expect(retryCall).toBeDefined();
    expect(JSON.parse(String(retryCall?.[1]?.body))).toMatchObject({ outputId: failedOutput.id, scope: "test" });
  });

  it("waits 30 seconds and retries unfinished renders twice before opening the results screen", async () => {
    vi.useFakeTimers();
    const failedOutput = {
      id: "1d13ccca-d537-4a5a-9a08-20df9c391007",
      day_offset: 1,
      group_name: "Test kampanyası",
      content_type: "image",
      generator: "ai-mini-quiz",
      language: "en",
      native_language: "tr",
      tier: "A1",
      scheduled_at: "2026-08-14T10:00:00+03:00",
      status: "failed",
      caption: null,
      mediaUrl: null,
      mediaUrls: [],
      media_type: null,
      error_code: "image_generation_failed",
    } as const;
    let retryCalls = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("/api/twitter-automation/automation-runs?")) return { ok: true, json: async () => ({ outputs: [failedOutput] }) };
      if (url === "/api/twitter-automation/automation-runs/retry") {
        retryCalls += 1;
        return { ok: true, json: async () => ({ outputId: failedOutput.id, status: "queued" }) };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GeneratedPostsTable onClose={vi.fn()} runId="1d13ccca-d537-4a5a-9a08-20df9c391007" scope="test" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByText("Gönderime hazır içerikler")).not.toBeInTheDocument();
    expect(screen.getAllByText(/30 sn sonra yeniden denenecek/u).length).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      await Promise.resolve();
    });
    expect(retryCalls).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getAllByText(/30 sn sonra yeniden denenecek/u).length).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      await Promise.resolve();
    });
    expect(retryCalls).toBe(2);
    expect(screen.getByText("Gönderime hazır içerikler")).toBeVisible();
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
    expect(screen.getByTestId("automation-loading-indicator")).toHaveClass("size-12", "animate-spin");
    expect(screen.getByTestId("automation-current-content-icon")).toHaveClass("size-4");
    expect(screen.queryByRole("button", { name: /Devam et ve videoya ses ekle/u })).not.toBeInTheDocument();
  });

  it("marks the point where deferred AI generations begin in the progress bar", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        outputs: [
          {
            id: "b090f621-90eb-448b-b6d5-6631c1506b71",
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
          },
          {
            id: "b090f621-90eb-448b-b6d5-6631c1506b72",
            day_offset: 1,
            group_name: "Test kampanyası",
            content_type: "image",
            generator: "ai-mini-quiz",
            language: "en",
            native_language: "tr",
            tier: "A1",
            scheduled_at: "2026-08-14T11:00:00+03:00",
            status: "queued",
            caption: null,
            mediaUrl: null,
            mediaUrls: [],
            media_type: null,
            error_code: null,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GeneratedPostsTable onClose={vi.fn()} runId="b090f621-90eb-448b-b6d5-6631c1506b70" scope="test" />);

    expect(await screen.findByTestId("automation-ai-generation-divider")).toHaveStyle({ left: "50%" });
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

  it("records the staging error only after three complete browser video render attempts", async () => {
    const pendingOutput = {
      id: "4d13ccca-d537-4a5a-9a08-20df9c391007",
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
    let didRecordFailure = false;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/twitter-automation/automation-runs?")) {
        return { ok: true, json: async () => ({ outputs: [didRecordFailure ? { ...pendingOutput, status: "failed", error_code: "browser_video_stage_failed" } : pendingOutput] }) };
      }
      if (url === "/api/twitter-automation/automation-runs/process") {
        if (String(init?.body).includes("browserVideoError")) didRecordFailure = true;
        return { ok: true, json: async () => ({ processed: true, outcome: "failed" }) };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(prepareMusicVideoAudio).mockReset();
    vi.mocked(renderMusicVideo).mockReset();
    vi.mocked(stageBrowserVideo).mockReset();
    vi.mocked(prepareMusicVideoAudio).mockResolvedValue({ state: "closed" } as AudioContext);
    vi.mocked(renderMusicVideo).mockResolvedValue(new Blob(["video"], { type: "video/webm" }));
    vi.mocked(stageBrowserVideo).mockRejectedValue(new Error("media_stage_unavailable"));

    render(<GeneratedPostsTable onClose={vi.fn()} runId={pendingOutput.id} scope="test" />);

    await waitFor(() => expect(stageBrowserVideo).toHaveBeenCalledTimes(3), { timeout: 6_000 });
    await waitFor(() => {
      const failureCall = fetchMock.mock.calls.find(([input, init]) => String(input) === "/api/twitter-automation/automation-runs/process" && String(init?.body).includes("browserVideoError"));
      expect(failureCall).toBeDefined();
      expect(JSON.parse(String(failureCall?.[1]?.body))).toMatchObject({
        outputId: pendingOutput.id,
        browserVideoError: "browser_video_stage_failed",
      });
    });
    expect(renderMusicVideo).toHaveBeenCalledTimes(3);
    expect(prepareMusicVideoAudio).toHaveBeenCalledTimes(3);
  });

  it("renders a browser video after audio preparation succeeds", async () => {
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
    const nextOutput = { ...failedOutput, id: "9d13ccca-d537-4a5a-9a08-20df9c391007", mediaUrl: "https://assets.test/next-poster.png", status: "ready_to_schedule" } as const;
    const readyResult = { ...failedOutput, status: "ready_to_schedule" } as const;
    let loadCount = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      void _init;
      const url = String(input);
      if (url.startsWith("/api/twitter-automation/automation-runs?")) {
        loadCount += 1;
        const outputs = loadCount <= 1
          ? [failedOutput, nextOutput]
          : [readyResult, nextOutput];
        return { ok: true, json: async () => ({ outputs }) };
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
    vi.mocked(stageBrowserVideo).mockResolvedValue({ path: "automation/7d13ccca-d537-4a5a-9a08-20df9c391007.webm", sourceUrl: "https://assets.test/retried-video.webm", mimeType: "video/webm" });

    render(<GeneratedPostsTable onClose={vi.fn()} runId="7d13ccca-d537-4a5a-9a08-20df9c391007" scope="test" />);

    await waitFor(() => expect(renderMusicVideo).toHaveBeenCalledTimes(1));
    expect(prepareMusicVideoAudio).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.some(([input, init]) => String(input) === "/api/twitter-automation/automation-runs/process" && String(init?.body).includes("browserVideoError"))).toBe(false);
    expect(stageBrowserVideo).toHaveBeenCalledTimes(1);
  });
});
