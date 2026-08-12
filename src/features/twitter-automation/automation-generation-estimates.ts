export type GenerationEstimateOutput = {
  id: string;
  contentType: string;
  generator: string;
  status: string;
};

const TEXT_GENERATORS = new Set(["fun-post", "word-quiz", "language-tip", "false-friends", "daily-challenge", "relatable-learner", "tiered-vocabulary", "example-sentences"]);
const AI_IMAGE_GENERATORS = new Set(["ai-word-of-the-day", "ai-mini-quiz", "ai-false-friends", "ai-daily-challenge", "ai-vocabulary-progression", "ai-example-sentences"]);
const SELF_IMAGE_GENERATORS = new Set(["word-of-the-day", "word-of-the-day-poster", "vocabulary-carousel", "tier-progression-carousel", "self-mini-quiz", "self-false-friends", "self-daily-challenge", "self-vocabulary-progression", "self-example-sentences"]);
const AI_IMAGE_VIDEO_GENERATORS = new Set(["music-ai-word-of-the-day", "music-ai-mini-quiz", "music-ai-false-friends", "music-ai-daily-challenge", "music-ai-vocabulary-progression", "music-ai-example-sentences"]);
const SELF_IMAGE_VIDEO_GENERATORS = new Set(["music-word-of-the-day", "music-word-of-the-day-poster", "music-self-mini-quiz", "music-self-false-friends", "music-self-daily-challenge", "music-self-vocabulary-progression", "music-self-example-sentences"]);
const BROWSER_LEARNING_VIDEO_GENERATORS = new Set(["confused-words-video", "marketing-dialogue-video", "learning-dialogue-video", "tier-progression-video", "vocabulary-quiz-video", "sentence-check-video", "sentence-translation-video"]);

export function estimateGenerationSeconds(output: Pick<GenerationEstimateOutput, "contentType" | "generator" | "status">) {
  if (output.status === "generating_video") return 90;
  if (TEXT_GENERATORS.has(output.generator) || output.contentType === "text") return 8;
  if (AI_IMAGE_GENERATORS.has(output.generator)) return 40;
  if (SELF_IMAGE_GENERATORS.has(output.generator)) return 12;
  if (output.generator === "ai-word-of-the-day-video") return 120;
  if (BROWSER_LEARNING_VIDEO_GENERATORS.has(output.generator)) return 75;
  if (AI_IMAGE_VIDEO_GENERATORS.has(output.generator)) return 95;
  if (SELF_IMAGE_VIDEO_GENERATORS.has(output.generator)) return 65;
  if (output.contentType === "image") return 25;
  if (output.contentType === "video") return 90;
  return 12;
}

export function estimateRemainingGenerationSeconds({ outputs, activeOutputId, activeElapsedSeconds = 0 }: {
  outputs: readonly GenerationEstimateOutput[];
  activeOutputId: string | null;
  activeElapsedSeconds?: number;
}) {
  return outputs.reduce((total, output) => {
    if (output.status === "ready_to_schedule" || output.status === "scheduled" || output.status === "failed" || output.status === "awaiting_browser_video") return total;
    const estimate = estimateGenerationSeconds(output);
    return total + (output.id === activeOutputId ? Math.max(0, estimate - Math.max(0, activeElapsedSeconds)) : estimate);
  }, 0);
}

export function formatEstimatedDuration(seconds: number) {
  const rounded = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  if (!minutes) return `${remainingSeconds} sn`;
  return remainingSeconds ? `${minutes} dk ${remainingSeconds} sn` : `${minutes} dk`;
}
