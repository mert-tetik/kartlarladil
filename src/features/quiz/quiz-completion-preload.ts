import { CHEST_TIER_ARTWORK, CHEST_TIER_OPENING_AUDIO, type ChestTier } from "@/features/quiz/chest-rewards";
import { preloadChestOpeningFrames } from "@/features/quiz/chest-opening-frames";
import { RANK_ICON_ASSETS } from "@/features/progress/rank-icons";
import { GEM_ASSETS } from "@/features/gems/gem-types";
import { preloadVideoFrameAtlas } from "@/components/video-frame-atlas-player";
import type { VideoFrameAtlasAssetId } from "@/lib/video-frame-atlas-assets";
import { preloadSoundEffects, type SoundEffectName } from "@/lib/sound-effects";
import type { RankIconId } from "@/types/domain";

const PRELOAD_TIMEOUT_MS = 1_200;

const COMPLETION_IMAGE_SOURCES = [
  "/quiz/result-cards/star.webp?v=20261003-2",
  "/chests/crack.webp",
  "/rank-up/kurdele-v1.webp",
  "/pricing-buttons/pricing-active-button-v2.webp",
  "/quiz/result-message-wave-20261003-1.webp",
  ...Object.values(GEM_ASSETS),
] as const;

const COMPLETION_FRAME_ATLAS_IDS = [
  "quiz-streak-intro",
  "quiz-streak-continuation",
  "rank-up-first",
  "rank-up-loop",
  "quiz-result-message",
] as const satisfies readonly VideoFrameAtlasAssetId[];

const COMPLETION_AUDIO_SOURCES = [
  "/quiz/result-message-video-audio.m4a?v=20261007-2",
  "/quiz/streak-reward-intro-audio.m4a?v=20261007-2",
  "/quiz/streak-reward-background-20260921-continuation-audio.m4a?v=20261007-2",
] as const;

const COMPLETION_SOUND_EFFECTS = [
  "quiz-completion-progress-pop",
  "streak-count-reveal",
  "rank-up-reveal",
  "chest-crack",
  "chest-open",
  "quiz-medal-reveal",
  "result-medal-collect",
  "word-repetition-complete",
  "bonus-reward-loot",
  "quiz-reward-box-pulse",
] as const satisfies readonly SoundEffectName[];

const scheduledImageSources = new Set<string>();
const scheduledAudioSources = new Set<string>();
const preloadedImages = new Map<string, HTMLImageElement>();
const preloadedMedia = new Map<string, HTMLMediaElement>();

function scheduleIdleWork(work: () => void) {
  if (typeof window === "undefined") return;

  const browserWindow = window as typeof window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  };

  if (browserWindow.requestIdleCallback) {
    browserWindow.requestIdleCallback(work, { timeout: PRELOAD_TIMEOUT_MS });
    return;
  }

  window.setTimeout(work, 300);
}

function preloadImageSource(source: string) {
  if (scheduledImageSources.has(source) || typeof window === "undefined") return;
  scheduledImageSources.add(source);

  const image = new window.Image();
  image.decoding = "async";
  image.src = source;
  preloadedImages.set(source, image);
  void image.decode?.().catch(() => undefined);
}

function preloadAudioSource(source: string) {
  if (scheduledAudioSources.has(source) || typeof document === "undefined") return;
  scheduledAudioSources.add(source);

  const media = document.createElement("audio");
  media.preload = "auto";
  media.muted = true;
  media.setAttribute("playsinline", "true");
  media.src = source;
  preloadedMedia.set(source, media);
  media.load();
}

export function preloadQuizCompletionAssets({
  chestTiers = [],
  rankIcons = [],
}: {
  chestTiers?: readonly ChestTier[];
  rankIcons?: readonly RankIconId[];
} = {}) {
  if (typeof window === "undefined") return;

  const chestImages = chestTiers.map((tier) => CHEST_TIER_ARTWORK[tier]);
  const chestAudio = chestTiers.map((tier) => CHEST_TIER_OPENING_AUDIO[tier]);
  const rankImages = rankIcons.map((icon) => RANK_ICON_ASSETS[icon]);

  scheduleIdleWork(() => {
    for (const source of [...COMPLETION_IMAGE_SOURCES, ...chestImages, ...rankImages]) {
      preloadImageSource(source);
    }

    for (const assetId of COMPLETION_FRAME_ATLAS_IDS) {
      void preloadVideoFrameAtlas(assetId, 1);
    }

    for (const tier of chestTiers) {
      void preloadChestOpeningFrames(tier).catch(() => undefined);
    }

    for (const source of [...COMPLETION_AUDIO_SOURCES, ...chestAudio]) {
      preloadAudioSource(source);
    }

    preloadSoundEffects(COMPLETION_SOUND_EFFECTS);
  });
}
