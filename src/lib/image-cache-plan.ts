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
  return manifest.criticalAssets ?? [];
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
  if (!cachedManifest) {
    return candidates;
  }

  const cachedRevisions = new Map(cachedManifest.assets.map((asset) => [asset.url, asset.revision]));

  return candidates.filter(
    (asset) => !cachedPaths.has(asset.url) || cachedRevisions.get(asset.url) !== asset.revision,
  );
}
