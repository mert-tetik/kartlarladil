/**
 * Client-side, conservative cost estimates for Content Automation.
 *
 * These figures reflect the exact providers and request shapes used by the
 * automation routes as of 2026-08-02. They deliberately exclude Upload-Post,
 * Supabase Storage and browser-side music rendering because those are not AI
 * generation charges in the current workflow.
 */

export type AutomationCostRow = {
  contentType: "random" | "text" | "image" | "video";
  generator: string;
  contentTypes?: Array<"text" | "image" | "video">;
  generators?: Partial<Record<"text" | "image" | "video", string>>;
};

type CostBreakdown = {
  poyoUsd: number;
};

export type AutomationCostEstimate = CostBreakdown & {
  totalUsd: number;
  oneOffTry: number;
  monthlyTry: number;
  monthlyPoyoTry: number;
};

// ECB's latest published USD/TRY reference at implementation time (2026-07-31).
const USD_TO_TRY = 47.525;
const MONTHLY_GENERATION_DAYS = 30;

const POYO_LUNA_INPUT_USD_PER_TOKEN = 0.28 / 1_000_000;
const POYO_LUNA_OUTPUT_USD_PER_TOKEN = 1.68 / 1_000_000;
const POYO_TERRA_INPUT_USD_PER_TOKEN = 0.7 / 1_000_000;
const POYO_TERRA_OUTPUT_USD_PER_TOKEN = 4.2 / 1_000_000;
const POYO_GPT_IMAGE_2_LOW_1K_USD = 0.01;

// Expected production usage, not max_output_tokens: the short social post is
// about 100 output tokens; image/video plans are structured JSON responses.
const TEXT_POST_POYO_USD = textCost({
  inputTokens: 750,
  outputTokens: 100,
  inputUsdPerToken: POYO_LUNA_INPUT_USD_PER_TOKEN,
  outputUsdPerToken: POYO_LUNA_OUTPUT_USD_PER_TOKEN,
});
const IMAGE_PLAN_POYO_USD = textCost({
  inputTokens: 1_800,
  outputTokens: 450,
  inputUsdPerToken: POYO_TERRA_INPUT_USD_PER_TOKEN,
  outputUsdPerToken: POYO_TERRA_OUTPUT_USD_PER_TOKEN,
});
const VIDEO_PLAN_POYO_USD = textCost({
  inputTokens: 1_400,
  outputTokens: 550,
  inputUsdPerToken: POYO_TERRA_INPUT_USD_PER_TOKEN,
  outputUsdPerToken: POYO_TERRA_OUTPUT_USD_PER_TOKEN,
});

const AI_IMAGE_POYO_USD = IMAGE_PLAN_POYO_USD + POYO_GPT_IMAGE_2_LOW_1K_USD;

// The avatar route produces three short TTS segments (lead-in, term,
// explanation). 240 characters and 12 seconds are the expected middle of the
// route's own prompt limits, then priced at PoYo's current public rate.
const AVATAR_VIDEO_POYO_USD = VIDEO_PLAN_POYO_USD + POYO_GPT_IMAGE_2_LOW_1K_USD + (240 / 1_000) * 0.04 + 12 * 0.035;

const AI_IMAGE_GENERATORS = new Set([
  "ai-word-of-the-day",
  "ai-mini-quiz",
  "ai-false-friends",
  "ai-daily-challenge",
  "ai-vocabulary-progression",
  "ai-example-sentences",
]);

const NON_AI_IMAGE_GENERATORS = new Set([
  "word-of-the-day",
  "word-of-the-day-poster",
]);

const TEXT_GENERATORS = new Set([
  "fun-post",
  "word-quiz",
  "language-tip",
  "false-friends",
  "daily-challenge",
  "relatable-learner",
  "tiered-vocabulary",
  "example-sentences",
]);

const MUSIC_AI_IMAGE_GENERATORS = new Set([
  "music-ai-word-of-the-day",
  "music-ai-mini-quiz",
  "music-ai-false-friends",
  "music-ai-daily-challenge",
  "music-ai-vocabulary-progression",
  "music-ai-example-sentences",
]);

const MUSIC_NON_AI_IMAGE_GENERATORS = new Set([
  "music-word-of-the-day",
  "music-word-of-the-day-poster",
]);

const CONFUSED_WORDS_VIDEO_GENERATOR = "confused-words-video";
// Terra writes three pair/explanation phases; their 24 short TTS fragments
// average roughly 480 characters in total. Canvas rendering itself has no AI charge.
const CONFUSED_WORDS_VIDEO_POYO_USD = VIDEO_PLAN_POYO_USD * 2 + (480 / 1_000) * 0.04;

function textCost({
  inputTokens,
  outputTokens,
  inputUsdPerToken,
  outputUsdPerToken,
}: {
  inputTokens: number;
  outputTokens: number;
  inputUsdPerToken: number;
  outputUsdPerToken: number;
}) {
  return inputTokens * inputUsdPerToken + outputTokens * outputUsdPerToken;
}

function addCosts(...costs: CostBreakdown[]): CostBreakdown {
  return costs.reduce<CostBreakdown>((total, cost) => ({ poyoUsd: total.poyoUsd + cost.poyoUsd }), { poyoUsd: 0 });
}

function averageCosts(costs: CostBreakdown[]): CostBreakdown {
  if (!costs.length) return { poyoUsd: 0 };
  const total = addCosts(...costs);
  return { poyoUsd: total.poyoUsd / costs.length };
}

function estimateGenerator(generator: string): CostBreakdown {
  if (TEXT_GENERATORS.has(generator)) return { poyoUsd: TEXT_POST_POYO_USD };
  if (AI_IMAGE_GENERATORS.has(generator) || MUSIC_AI_IMAGE_GENERATORS.has(generator)) {
    return { poyoUsd: AI_IMAGE_POYO_USD };
  }
  if (NON_AI_IMAGE_GENERATORS.has(generator) || MUSIC_NON_AI_IMAGE_GENERATORS.has(generator)) {
    return { poyoUsd: 0 };
  }
  if (generator === "ai-word-of-the-day-video") {
    return { poyoUsd: AVATAR_VIDEO_POYO_USD };
  }
  if (generator === CONFUSED_WORDS_VIDEO_GENERATOR) return { poyoUsd: CONFUSED_WORDS_VIDEO_POYO_USD };

  if (generator === "random-text") return { poyoUsd: TEXT_POST_POYO_USD };
  if (generator === "random-ai-image") return { poyoUsd: AI_IMAGE_POYO_USD };
  if (generator === "random-no-ai-image") return { poyoUsd: 0 };
  if (generator === "random-image") {
    return averageCosts([
      ...Array.from(AI_IMAGE_GENERATORS, () => ({ poyoUsd: AI_IMAGE_POYO_USD })),
      ...Array.from(NON_AI_IMAGE_GENERATORS, () => ({ poyoUsd: 0 })),
    ]);
  }
  if (generator === "random-image-to-video") {
    return averageCosts([
      ...Array.from(MUSIC_AI_IMAGE_GENERATORS, () => ({ poyoUsd: AI_IMAGE_POYO_USD })),
      ...Array.from(MUSIC_NON_AI_IMAGE_GENERATORS, () => ({ poyoUsd: 0 })),
    ]);
  }
  if (generator === "random-ai-video") {
    return averageCosts([
      { poyoUsd: AVATAR_VIDEO_POYO_USD },
      { poyoUsd: CONFUSED_WORDS_VIDEO_POYO_USD },
      ...Array.from(MUSIC_AI_IMAGE_GENERATORS, () => ({ poyoUsd: AI_IMAGE_POYO_USD })),
    ]);
  }
  if (generator === "random-video") {
    return averageCosts([
      { poyoUsd: AVATAR_VIDEO_POYO_USD },
      { poyoUsd: CONFUSED_WORDS_VIDEO_POYO_USD },
      ...Array.from(MUSIC_AI_IMAGE_GENERATORS, () => ({ poyoUsd: AI_IMAGE_POYO_USD })),
      ...Array.from(MUSIC_NON_AI_IMAGE_GENERATORS, () => ({ poyoUsd: 0 })),
    ]);
  }

  return { poyoUsd: 0 };
}

function selectedContentTypes(row: AutomationCostRow) {
  if (row.contentTypes?.length) return [...new Set(row.contentTypes)];
  if (row.contentType === "text" || row.contentType === "image" || row.contentType === "video") return [row.contentType];
  return ["text", "image", "video"] as const;
}

function fallbackGenerator(contentType: "text" | "image" | "video") {
  return contentType === "text" ? "random-text" : contentType === "image" ? "random-ai-image" : "random-video";
}

function estimateRow(row: AutomationCostRow): CostBreakdown {
  return averageCosts(selectedContentTypes(row).map((contentType) => estimateGenerator(
    row.generators?.[contentType] ?? (row.contentType === contentType ? row.generator : fallbackGenerator(contentType)),
  )));
}

export function estimateAutomationGroupCost(rows: readonly AutomationCostRow[]): AutomationCostEstimate {
  const oneOff = addCosts(...rows.map(estimateRow));
  const totalUsd = oneOff.poyoUsd;
  return {
    ...oneOff,
    totalUsd,
    oneOffTry: totalUsd * USD_TO_TRY,
    monthlyTry: totalUsd * USD_TO_TRY * MONTHLY_GENERATION_DAYS,
    monthlyPoyoTry: oneOff.poyoUsd * USD_TO_TRY * MONTHLY_GENERATION_DAYS,
  };
}

export function formatAutomationCostTry(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function describeAutomationCostEstimate(estimate: AutomationCostEstimate) {
  const provider = estimate.poyoUsd > 0 ? `PoYo ${formatAutomationCostTry(estimate.poyoUsd * USD_TO_TRY)}` : "No paid AI provider is used";
  return `AI generation estimate: ${formatAutomationCostTry(estimate.oneOffTry)} for one daily run, ${formatAutomationCostTry(estimate.monthlyTry)} for 30 daily runs. ${provider}. Uses USD/TRY 47.525 (2026-07-31). Random modes use their expected average; one generated item is shared across all selected social accounts.`;
}
