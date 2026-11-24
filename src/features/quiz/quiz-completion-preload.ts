import { CARD_GROUP_IMAGE_PATHS } from "@/features/cards/card-groups";
import { RESULT_BUTTON_IMAGES } from "@/components/image-action-button";
import { CHEST_TIER_ARTWORK, CHEST_TIER_OPENING_AUDIO, CHEST_TIER_PREVIEW_ARTWORK, type ChestTier } from "@/features/quiz/chest-rewards";
import { preloadChestOpeningFrames } from "@/features/quiz/chest-opening-frames";
import { RANK_ICON_ASSETS } from "@/features/progress/rank-icons";
import { GEM_ASSETS } from "@/features/gems/gem-types";
import { preloadVideoFrameAtlas } from "@/components/video-frame-atlas-player";
import type { VideoFrameAtlasAssetId } from "@/lib/video-frame-atlas-assets";
import { preloadSoundEffects, type SoundEffectName } from "@/lib/sound-effects";
import { QUIZ_MISSION_CARD_IMAGE_SOURCES } from "@/features/missions/components/mission-card";
import { QUIZ_CONTINUATION_IMAGE_SOURCES } from "@/features/quiz/components/quiz-continuation-motivation-view";

const PRELOAD_TIMEOUT_MS = 1_200;

/**
 * Static artwork used across the Learn quiz completion flow. Dynamic card-group,
 * chest, and rank variants are included so the result can render without a
 * first-use image decode after the quiz finishes.
 */
export const QUIZ_COMPLETION_IMAGE_SOURCES = [...new Set([
  "/quiz/result-cards/star.webp?v=20261003-2",
  "/quiz/result-cards/star.webp?v=20261005-1",
  "/quiz/result-message-wave-20261003-1.webp",
  "/quiz/result-message-bubble.webp?v=20261008-1",
  "/quiz/result-learned-trophy.webp",
  "/quiz/cards_icon3.webp",
  "/chests/crack.webp",
  "/rank-up/kurdele-v1.webp",
  "/pricing-buttons/pricing-active-button-v2.webp",
  "/score-icon.webp",
  "/card-status/kart_ogrenildi_madalyasi.webp",
  "/card-status/kart_ogreniliyor_madalyasi.webp",
  "/leaderboard-icon-v20261006-2.webp",
  ...Object.values(CHEST_TIER_ARTWORK),
  ...Object.values(CHEST_TIER_PREVIEW_ARTWORK),
  ...Object.values(RANK_ICON_ASSETS),
  ...Object.values(GEM_ASSETS),
  ...Object.values(CARD_GROUP_IMAGE_PATHS),
  ...Object.values(RESULT_BUTTON_IMAGES),
  ...QUIZ_CONTINUATION_IMAGE_SOURCES,
  ...QUIZ_MISSION_CARD_IMAGE_SOURCES,
])] as const;

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

const preloadedImages = new Map<string, HTMLImageElement>();
const preloadedMedia = new Map<string, HTMLMediaElement>();
const chestFramePreloads = new Set<ChestTier>();
let completionImageLeaseCount = 0;
let completionMediaScheduled = false;
let preloadGeneration = 0;

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
  if (preloadedImages.has(source) || typeof window === "undefined") return;

  const image = new window.Image();
  image.decoding = "async";
  image.loading = "eager";
  image.fetchPriority = "low";
  preloadedImages.set(source, image);
  image.onerror = () => {
    if (preloadedImages.get(source) === image) preloadedImages.delete(source);
  };
  image.src = source;

  if (typeof image.decode === "function") {
    void image.decode().catch(() => {
      if (preloadedImages.get(source) === image) preloadedImages.delete(source);
    });
  }
}

function preloadAudioSource(source: string) {
  if (preloadedMedia.has(source) || typeof document === "undefined") return;

  const media = document.createElement("audio");
  media.preload = "auto";
  media.muted = true;
  media.setAttribute("playsinline", "true");
  media.src = source;
  preloadedMedia.set(source, media);
  media.load();
}

/**
 * Decode and retain all static quiz-completion artwork while Learn is mounted.
 * The returned lease is safe under React Strict Mode and shared Learn mounts.
 */
export function preloadQuizCompletionAssets() {
  if (typeof window === "undefined") return () => undefined;

  completionImageLeaseCount += 1;
  for (const source of QUIZ_COMPLETION_IMAGE_SOURCES) preloadImageSource(source);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    completionImageLeaseCount = Math.max(0, completionImageLeaseCount - 1);

    if (completionImageLeaseCount === 0) {
      preloadGeneration += 1;
      completionMediaScheduled = false;
      preloadedImages.clear();
      preloadedMedia.clear();
      chestFramePreloads.clear();
    }
  };
}

/** Warm completion videos, sounds, and only the selected chest-pair frame sequences. */
export function preloadQuizCompletionMotionAssets({
  chestTiers = [],
}: {
  chestTiers?: readonly ChestTier[];
} = {}) {
  if (typeof window === "undefined" || completionImageLeaseCount === 0) return;
  const generation = preloadGeneration;
  const tiersToWarm = chestTiers.filter((tier) => !chestFramePreloads.has(tier));
  tiersToWarm.forEach((tier) => chestFramePreloads.add(tier));

  scheduleIdleWork(() => {
    if (generation !== preloadGeneration || completionImageLeaseCount === 0) {
      tiersToWarm.forEach((tier) => chestFramePreloads.delete(tier));
      return;
    }

    if (!completionMediaScheduled) {
      completionMediaScheduled = true;
      for (const assetId of COMPLETION_FRAME_ATLAS_IDS) {
        void preloadVideoFrameAtlas(assetId, 1);
      }
      for (const source of COMPLETION_AUDIO_SOURCES) preloadAudioSource(source);
      preloadSoundEffects(COMPLETION_SOUND_EFFECTS);
    }

    for (const tier of tiersToWarm) {
      preloadAudioSource(CHEST_TIER_OPENING_AUDIO[tier]);
      // Limit animated-frame memory to the active player instead of retaining
      // every decoded chest frame in the Learn session.
      void preloadChestOpeningFrames(tier).catch(() => chestFramePreloads.delete(tier));
    }
  });
}
