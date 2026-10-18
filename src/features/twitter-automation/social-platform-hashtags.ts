import { getLearningLanguageHashtags } from "@/features/twitter-automation/social-video-titles";
import { normalizeUploadPostPlatform } from "@/features/twitter-automation/upload-post-capabilities";
import type { LanguageCode } from "@/types/domain";

const DORFIC_HASHTAGS = ["#DORFic", "#FrutigerAero"] as const;

const DORFIC_AI_IMAGE_GENERATORS = new Set([
  "ai-word-of-the-day",
  "ai-mini-quiz",
  "ai-false-friends",
  "ai-daily-challenge",
  "ai-vocabulary-progression",
  "ai-example-sentences",
  "ai-word-of-the-day-video",
  "music-ai-word-of-the-day",
  "music-ai-mini-quiz",
  "music-ai-false-friends",
  "music-ai-daily-challenge",
  "music-ai-vocabulary-progression",
  "music-ai-example-sentences",
]);

const PLATFORM_HASHTAG_LIMITS: Readonly<Record<string, number>> = {
  x: 2,
  instagram: 5,
  tiktok: 5,
  youtube: 3,
  linkedin: 3,
  facebook: 3,
  pinterest: 3,
  bluesky: 3,
  mastodon: 3,
  nostr: 3,
  lemmy: 3,
};

// These destinations either have a native topic/discovery mechanism or do not
// use hashtags as a useful post-discovery feature. Avoid making captions noisy.
const PLATFORMS_WITHOUT_CAPTION_HASHTAGS = new Set([
  "threads",
  "discord",
  "telegram",
  "slack",
  "google_business",
  "wordpress",
  "devto",
  "hashnode",
  "whop",
  "listmonk",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function usesDorficVisualStyle(generator: string | undefined, renderPlan?: unknown) {
  const plan = asRecord(renderPlan);
  if (plan?.kind === "ai-avatar-video") return true;

  const candidates = [generator, typeof plan?.generator === "string" ? plan.generator : undefined];
  return candidates.some((candidate) => typeof candidate === "string" && DORFIC_AI_IMAGE_GENERATORS.has(candidate));
}

export function getSocialPostHashtags({
  platform,
  learningLanguage,
  nativeLanguage,
  dorficVisual = false,
}: {
  platform: string;
  learningLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  dorficVisual?: boolean;
}) {
  const normalizedPlatform = normalizeUploadPostPlatform(platform);
  if (PLATFORMS_WITHOUT_CAPTION_HASHTAGS.has(normalizedPlatform)) return [];

  const curated = getLearningLanguageHashtags(learningLanguage, nativeLanguage);
  const limit = PLATFORM_HASHTAG_LIMITS[normalizedPlatform] ?? 5;
  if (!dorficVisual || limit < DORFIC_HASHTAGS.length) return curated.slice(0, limit);

  return [...curated.slice(0, Math.max(0, limit - DORFIC_HASHTAGS.length)), ...DORFIC_HASHTAGS];
}

export function adaptSocialCaptionHashtags({
  caption,
  platform,
  learningLanguage,
  nativeLanguage,
  dorficVisual = false,
}: {
  caption: string;
  platform: string;
  learningLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  dorficVisual?: boolean;
}) {
  const captionWithoutHashtags = caption
    .replace(/#[\p{L}\p{N}_-]+/gu, "")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  const hashtags = getSocialPostHashtags({ platform, learningLanguage, nativeLanguage, dorficVisual });

  return [captionWithoutHashtags, hashtags.join(" ")].filter(Boolean).join("\n\n");
}
