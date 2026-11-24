import { isChestOpeningFrameUrl } from "./image-runtime-cache-policy";

export interface ImageCacheAsset {
  url: string;
  revision: string;
}

export interface ImageCacheManifest {
  version: string;
  assets: ImageCacheAsset[];
  criticalAssets?: ImageCacheAsset[];
}

export function getCriticalImageAssets(manifest: ImageCacheManifest) {
  return (manifest.criticalAssets ?? []).filter((asset) => !isChestOpeningFrameUrl(asset.url));
}

export function getAssetsRequiringCache({
  candidates,
  cachedPaths,
  cachedManifest,
}: {
  candidates: ImageCacheAsset[];
  cachedPaths: Set<string>;
  cachedManifest: ImageCacheManifest | null;
}) {
  const cacheableCandidates = candidates.filter((asset) => !isChestOpeningFrameUrl(asset.url));

  if (!cachedManifest) {
    return cacheableCandidates;
  }

  const cachedRevisions = new Map(cachedManifest.assets.map((asset) => [asset.url, asset.revision]));

  return cacheableCandidates.filter(
    (asset) => !cachedPaths.has(asset.url) || cachedRevisions.get(asset.url) !== asset.revision,
  );
}
