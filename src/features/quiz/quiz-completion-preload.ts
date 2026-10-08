import { CHEST_TIER_ARTWORK, CHEST_TIER_OPENING_AUDIO, CHEST_TIER_OPENING_VIDEOS, type ChestTier } from "@/features/quiz/chest-rewards";
import { RANK_ICON_ASSETS } from "@/features/progress/rank-icons";
import { GEM_ASSETS } from "@/features/gems/gem-types";
import { preloadSoundEffects, type SoundEffectName } from "@/lib/sound-effects";
import type { RankIconId } from "@/types/domain";

const PRELOAD_TIMEOUT_MS = 1_200;

const COMPLETION_IMAGE_SOURCES = [
  "/quiz/result-cards/star.png?v=20261003-2",
  "/chests/crack.png",
  "/rank-up/kurdele-v1.png",
  "/pricing-buttons/pricing-active-button-v2.png",
  "/quiz/result-message-wave-20261003-1.png",
  ...Object.values(GEM_ASSETS),
] as const;

const COMPLETION_VIDEO_SOURCES = [
  "/quiz/streak-animation.mp4?v=20261007-2",
  "/quiz/streak-reward-background-20260921-intro.mp4?v=20261007-2",
  "/quiz/streak-reward-background-20260921-continuation.mp4?v=20261007-2",
  "/rank-up/rank-up-background-first.mp4?v=20261007-2",
  "/rank-up/rank-up-background-loopedvideo.mp4?v=20261007-1",
  "/quiz/result_message_video.mp4?v=20261007-2",
  "/quiz/result_animation_1.mp4?v=20261007-2",
  "/quiz/result_animation_2.mp4?v=20261007-2",
] as const;

const COMPLETION_AUDIO_SOURCES = [
  "/quiz/result-message-video-audio.m4a?v=20261007-2",
  "/quiz/streak-reward-intro-audio.m4a?v=20261007-2",
  "/quiz/streak-reward-background-20260921-continuation-audio.m4a?v=20261007-2",
  "/quiz/result-animation-1-audio.m4a?v=20261007-2",
  "/quiz/result-animation-2-audio.m4a?v=20261007-2",
] as const;

const COMPLETION_SOUND_EFFECTS = [
  "quiz-completion-progress-pop",
  "streak-video-whoosh",
  "streak-count-reveal",
  "rank-up-reveal",
  "chest-crack",
  "chest-open",
  "quiz-medal-reveal",
  "result-medal-collect",
  "bonus-reward-loot",
] as const satisfies readonly SoundEffectName[];

const scheduledImageSources = new Set<string>();
const scheduledVideoSources = new Set<string>();
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

function preloadMediaSource(source: string, kind: "audio" | "video") {
  const scheduledSources = kind === "audio" ? scheduledAudioSources : scheduledVideoSources;
  if (scheduledSources.has(source) || typeof document === "undefined") return;
  scheduledSources.add(source);

  const media = document.createElement(kind);
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
  const chestVideos = chestTiers.map((tier) => CHEST_TIER_OPENING_VIDEOS[tier]);
  const chestAudio = chestTiers.map((tier) => CHEST_TIER_OPENING_AUDIO[tier]);
  const rankImages = rankIcons.map((icon) => RANK_ICON_ASSETS[icon]);

  scheduleIdleWork(() => {
    for (const source of [...COMPLETION_IMAGE_SOURCES, ...chestImages, ...rankImages]) {
      preloadImageSource(source);
    }

    for (const source of [...COMPLETION_VIDEO_SOURCES, ...chestVideos]) {
      preloadMediaSource(source, "video");
    }

    for (const source of [...COMPLETION_AUDIO_SOURCES, ...chestAudio]) {
      preloadMediaSource(source, "audio");
    }

    preloadSoundEffects(COMPLETION_SOUND_EFFECTS);
  });
}
