import { describe, expect, it } from "vitest";
import {
  isChestOpeningFrameUrl,
  shouldUseRuntimeImageCache,
} from "./image-runtime-cache-policy";

describe("isChestOpeningFrameUrl", () => {
  it("recognizes local chest frame paths with query parameters", () => {
    expect(
      isChestOpeningFrameUrl(
        "/chests/opening-frames/wood-frames/frame-001.webp?v=sequence-1",
      ),
    ).toBe(true);
  });

  it("does not classify other chest art or other image paths as animation frames", () => {
    expect(isChestOpeningFrameUrl("/chests/count-preview/wood.webp")).toBe(false);
    expect(isChestOpeningFrameUrl("/mascots/fox.webp")).toBe(false);
  });
});

describe("shouldUseRuntimeImageCache", () => {
  it("keeps ordinary image requests in the runtime image cache", () => {
    expect(
      shouldUseRuntimeImageCache({
        destination: "image",
        url: "https://www.foxiesdeck.com/mascots/fox.webp",
      } as Request),
    ).toBe(true);
  });

  it("leaves chest animation frames uncached so native/network delivery is authoritative", () => {
    expect(
      shouldUseRuntimeImageCache({
        destination: "image",
        url: "https://www.foxiesdeck.com/chests/opening-frames/wood-frames/frame-001.webp?v=20261104",
      } as Request),
    ).toBe(false);
  });

  it("does not cache non-image requests", () => {
    expect(
      shouldUseRuntimeImageCache({
        destination: "empty",
        url: "https://www.foxiesdeck.com/chests/opening-frames/wood-frames/frame-001.webp",
      } as unknown as Request),
    ).toBe(false);
  });
});
