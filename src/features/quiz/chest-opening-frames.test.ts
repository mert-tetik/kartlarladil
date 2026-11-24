import { describe, expect, it } from "vitest";
import { getChestOpeningFrameSource, loadChestOpeningFrameImage } from "./chest-opening-frames";

describe("chest opening frame assets", () => {
  it("maps every chest tier and frame index to an individual frame image", () => {
    const tiers = ["wood", "iron", "gold", "diamond", "emerald", "ruby"] as const;

    for (const tier of tiers) {
      expect(getChestOpeningFrameSource(tier, 0)).toBe(
        `/chests/opening-frames/${tier}-frames/frame-001.webp?v=20261124-native-cache-routing-1`,
      );
    }

    expect(getChestOpeningFrameSource("iron", 15)).toContain("frame-016.webp");
    expect(getChestOpeningFrameSource("iron", 16)).toContain("frame-017.webp");
    expect(getChestOpeningFrameSource("iron", 96)).toContain("frame-097.webp");
  });

  it("clamps frame indexes to the available sequence", () => {
    expect(getChestOpeningFrameSource("wood", -1)).toContain("frame-001.webp");
    expect(getChestOpeningFrameSource("wood", 97)).toContain("frame-097.webp");
  });

  it("retries a failed bundled frame through the explicit remote media fallback", async () => {
    const attemptedSources: string[] = [];
    const decodedUrls: string[] = [];

    class MockImage {
      decoding = "";
      src = "";
      naturalWidth = 480;
      naturalHeight = 854;
      complete = false;
      onload: ((event: Event) => unknown) | null = null;
      onerror: ((event: Event) => unknown) | null = null;

      decode() {
        decodedUrls.push(this.src);
        if (this.src.includes("native-media-fallback=1")) return Promise.resolve();

        queueMicrotask(() => this.onerror?.(new Event("error")));
        return new Promise<void>(() => undefined);
      }
    }

    const originalImageConstructor = window.Image;
    window.Image = MockImage as unknown as typeof Image;
    try {
      const image = await loadChestOpeningFrameImage(
        "/chests/opening-frames/wood-frames/frame-001.webp?v=test",
        (source) => attemptedSources.push(source),
      );

      expect(image.src).toContain("native-media-fallback=1");
      expect(attemptedSources).toEqual(["bundled", "remote-fallback"]);
      expect(decodedUrls).toHaveLength(2);
    } finally {
      window.Image = originalImageConstructor;
    }
  });

  it("reports a hard failure only after both bundled and remote frame sources fail", async () => {
    class MockImage {
      decoding = "";
      src = "";
      naturalWidth = 0;
      naturalHeight = 0;
      complete = true;
      onload: ((event: Event) => unknown) | null = null;
      onerror: ((event: Event) => unknown) | null = null;

      decode() {
        return Promise.reject(new Error("Frame decode failed"));
      }
    }

    const originalImageConstructor = window.Image;
    window.Image = MockImage as unknown as typeof Image;
    try {
      await expect(
        loadChestOpeningFrameImage("/chests/opening-frames/wood-frames/frame-001.webp?v=test"),
      ).rejects.toThrow("Frame decode failed");
    } finally {
      window.Image = originalImageConstructor;
    }
  });

  it("keeps a valid frame when decode rejects before the image load event", async () => {
    class MockImage {
      decoding = "";
      src = "";
      naturalWidth = 480;
      naturalHeight = 854;
      complete = false;
      onload: ((event: Event) => unknown) | null = null;
      onerror: ((event: Event) => unknown) | null = null;

      decode() {
        window.setTimeout(() => {
          this.complete = true;
          this.onload?.(new Event("load"));
        }, 0);
        return Promise.reject(new Error("decode() settled before load"));
      }
    }

    const originalImageConstructor = window.Image;
    window.Image = MockImage as unknown as typeof Image;
    try {
      const image = await loadChestOpeningFrameImage(
        "/chests/opening-frames/wood-frames/frame-001.webp?v=test",
      );

      expect(image.src).toContain("frame-001.webp");
      expect(image.src).not.toContain("native-media-fallback=1");
    } finally {
      window.Image = originalImageConstructor;
    }
  });
});
