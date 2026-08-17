import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCanvasSafeImage } from "./music-video-renderer";

class MockImage {
  decoding = "async";
  height = 1200;
  naturalHeight = 1200;
  naturalWidth = 900;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  width = 900;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

describe("loadCanvasSafeImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rehydrates a signed image URL as a local blob URL before canvas rendering", async () => {
    const createObjectUrl = vi.fn(() => "blob:foxiesdeck-image");
    const revokeObjectUrl = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["image"], { type: "image/png" }),
    }));
    vi.stubGlobal("Image", MockImage);
    vi.stubGlobal("URL", { createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl });

    const source = await loadCanvasSafeImage("https://project.supabase.co/storage/v1/object/sign/automation/poster.png");

    expect(fetch).toHaveBeenCalledWith("https://project.supabase.co/storage/v1/object/sign/automation/poster.png");
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(source.image.naturalWidth).toBe(900);
    source.release();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:foxiesdeck-image");
  });

  it("reports a clear image source failure before starting a video render", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(loadCanvasSafeImage("https://project.supabase.co/storage/v1/object/sign/missing.png")).rejects.toThrow("music_image_load_failed");
  });
});
