import {
  getAssetsRequiringCache,
  getCriticalImageAssets,
  type ImageCacheManifest,
} from "@/lib/image-cache-plan";

const assets = [
  { url: "/splash.png", revision: "splash-v1" },
  { url: "/mascots/mascot1.webp", revision: "mascot-v1" },
  { url: "/ranks/rank1.webp", revision: "rank-v1" },
];

const manifest: ImageCacheManifest = {
  version: "manifest-v1",
  assets,
  criticalAssets: [assets[0]],
};

describe("image cache plan", () => {
  it("returns only the generated critical assets for the blocking cache pass", () => {
    expect(getCriticalImageAssets(manifest)).toEqual([assets[0]]);
  });

  it("never pre-caches chest frame sequences, even if a manifest marks them critical", () => {
    const chestFrame = {
      url: "/chests/opening-frames/wood-frames/frame-001.webp",
      revision: "chest-frame-v1",
    };

    expect(
      getCriticalImageAssets({
        ...manifest,
        criticalAssets: [assets[0], chestFrame],
      }),
    ).toEqual([assets[0]]);
    expect(
      getAssetsRequiringCache({
        candidates: [...assets, chestFrame],
        cachedPaths: new Set(),
        cachedManifest: null,
      }),
    ).toEqual(assets);
  });

  it("caches every candidate on a first install", () => {
    expect(
      getAssetsRequiringCache({
        candidates: assets,
        cachedPaths: new Set(),
        cachedManifest: null,
      }),
    ).toEqual(assets);
  });

  it("only recaches missing or changed assets after an update", () => {
    const nextAssets = [
      assets[0],
      { url: "/mascots/mascot1.webp", revision: "mascot-v2" },
      assets[2],
    ];

    expect(
      getAssetsRequiringCache({
        candidates: nextAssets,
        cachedPaths: new Set(["/splash.png", "/mascots/mascot1.webp"]),
        cachedManifest: manifest,
      }),
    ).toEqual([nextAssets[1], nextAssets[2]]);
  });

  it("continues a partial cache in the background without redownloading the critical asset", () => {
    const partiallyCachedManifest: ImageCacheManifest = {
      ...manifest,
      assets: [assets[0]],
    };

    expect(
      getAssetsRequiringCache({
        candidates: assets,
        cachedPaths: new Set(["/splash.png"]),
        cachedManifest: partiallyCachedManifest,
      }),
    ).toEqual([assets[1], assets[2]]);
  });
});
