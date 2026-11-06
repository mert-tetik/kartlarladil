import { afterEach, describe, expect, it, vi } from "vitest";
import { preloadWebpFrameSequence } from "@/components/webp-frame-sequence-player";

describe("preloadWebpFrameSequence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads every requested frame before resolving and decodes only the opening window", async () => {
    const requestedSources: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      requestedSources.push(String(input));
      return {
        ok: true,
        status: 200,
        blob: async () => new Blob(["webp-frame"], { type: "image/webp" }),
      } as Response;
    });
    const decodeMock = vi.fn(async () => undefined);

    class MockImage {
      complete = true;
      naturalWidth = 720;
      naturalHeight = 689;
      decoding = "async";
      loading = "eager";
      fetchPriority = "auto";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = "";

      decode = decodeMock;
    }

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Image", MockImage);

    await expect(preloadWebpFrameSequence("tutorial-welcome", 97)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(97);
    expect(new Set(requestedSources).size).toBe(97);
    expect(requestedSources).toContain(
      "/mascots/tutorial-welcome/frames/frame-097.webp?v=20261104-webp-frames-1",
    );
    expect(decodeMock).toHaveBeenCalledTimes(16);
  });
});
