export const VIDEO_FRAME_ATLAS_VERSION = "20261104-2";

export const VIDEO_FRAME_ATLAS_ASSETS = {
  "tutorial-welcome": { frameCount: 97, fps: 45, frameWidth: 720, frameHeight: 689, columns: 4, rows: 2 },
  "quiz-feedback-animation-1": { frameCount: 104, fps: 24, frameWidth: 480, frameHeight: 480, columns: 4, rows: 4 },
  "quiz-feedback-animation-2": { frameCount: 97, fps: 24, frameWidth: 480, frameHeight: 358, columns: 4, rows: 4 },
  "quiz-feedback-animation-3": { frameCount: 122, fps: 30, frameWidth: 480, frameHeight: 360, columns: 4, rows: 4 },
  "quiz-feedback-animation-4": { frameCount: 95, fps: 30, frameWidth: 480, frameHeight: 480, columns: 4, rows: 4 },
  "quiz-feedback-animation-5": { frameCount: 104, fps: 30, frameWidth: 480, frameHeight: 360, columns: 4, rows: 4 },
  "quiz-feedback-bonus-celebration": { frameCount: 43, fps: 30, frameWidth: 360, frameHeight: 480, columns: 4, rows: 4 },
  "quiz-streak-intro": { frameCount: 64, fps: 30, frameWidth: 720, frameHeight: 1280, columns: 4, rows: 2 },
  "quiz-streak-continuation": { frameCount: 58, fps: 30, frameWidth: 720, frameHeight: 1280, columns: 4, rows: 2 },
  "rank-up-first": { frameCount: 39, fps: 30, frameWidth: 480, frameHeight: 480, columns: 4, rows: 4 },
  "rank-up-loop": { frameCount: 97, fps: 24, frameWidth: 480, frameHeight: 480, columns: 4, rows: 4 },
  "quiz-result-message": { frameCount: 145, fps: 30, frameWidth: 480, frameHeight: 854, columns: 4, rows: 4 },
} as const;

export type VideoFrameAtlasAssetId = keyof typeof VIDEO_FRAME_ATLAS_ASSETS;

export function getVideoFrameAtlasCount(assetId: VideoFrameAtlasAssetId) {
  const asset = VIDEO_FRAME_ATLAS_ASSETS[assetId];
  return Math.ceil(asset.frameCount / (asset.columns * asset.rows));
}

export function getVideoFrameAtlasSource(assetId: VideoFrameAtlasAssetId, atlasIndex: number) {
  const atlasNumber = String(atlasIndex + 1).padStart(3, "0");
  return `/video-frame-atlases/${assetId}/atlas-${atlasNumber}.webp?v=${VIDEO_FRAME_ATLAS_VERSION}`;
}
