export const RANDOM_GENERATOR = "random";

export const AUTOMATION_CONTENT_TYPES = ["text", "image", "video"] as const;
export type AutomationContentType = (typeof AUTOMATION_CONTENT_TYPES)[number];

export const RANDOM_INCLUDE_OPTIONS = {
  text: [{ value: "ai", label: "AI" }],
  image: [
    { value: "self", label: "SELF" },
    { value: "ai", label: "AI" },
  ],
  video: [
    { value: "ai", label: "AI" },
    { value: "self", label: "SELF" },
    { value: "img", label: "IMG" },
  ],
} as const;

type RandomIncludeOptionMap = typeof RANDOM_INCLUDE_OPTIONS;
export type RandomInclude<C extends AutomationContentType> = RandomIncludeOptionMap[C][number]["value"];
export type RandomIncludes = Partial<{ [C in AutomationContentType]: RandomInclude<C>[] }>;

export const AUTOMATION_GENERATOR_OPTIONS: Record<AutomationContentType, ReadonlyArray<{ value: string; label: string }>> = {
  text: [
    { value: RANDOM_GENERATOR, label: "Random" },
    { value: "fun-post", label: "Fun FoxiesDeck Post" },
    { value: "word-quiz", label: "Word Quiz" },
    { value: "language-tip", label: "Language Tip" },
    { value: "false-friends", label: "False Friends" },
    { value: "daily-challenge", label: "Daily Challenge" },
    { value: "relatable-learner", label: "Relatable Learner Post" },
    { value: "tiered-vocabulary", label: "Tiered Vocabulary" },
    { value: "example-sentences", label: "Example Sentences" },
  ],
  image: [
    { value: RANDOM_GENERATOR, label: "Random" },
    { value: "word-of-the-day", label: "Word of the Day" },
    { value: "word-of-the-day-poster", label: "Word of the Day Poster" },
    { value: "ai-word-of-the-day", label: "AI Word of the Day" },
    { value: "ai-mini-quiz", label: "AI Mini Quiz" },
    { value: "ai-false-friends", label: "AI False Friends" },
    { value: "ai-daily-challenge", label: "AI Daily Challenge" },
    { value: "ai-vocabulary-progression", label: "AI Beginner to Advanced" },
    { value: "ai-example-sentences", label: "AI Example Sentences" },
  ],
  video: [
    { value: RANDOM_GENERATOR, label: "Random" },
    { value: "ai-word-of-the-day-video", label: "AI Word of the Day Video" },
    { value: "confused-words-video", label: "Confused Words Explainer Video" },
    { value: "music-word-of-the-day", label: "Word of the Day Music Video" },
    { value: "music-word-of-the-day-poster", label: "Word of the Day Poster Music Video" },
    { value: "music-ai-word-of-the-day", label: "AI Word of the Day Music Video" },
    { value: "music-ai-mini-quiz", label: "AI Mini Quiz Music Video" },
    { value: "music-ai-false-friends", label: "AI False Friends Music Video" },
    { value: "music-ai-daily-challenge", label: "AI Daily Challenge Music Video" },
    { value: "music-ai-vocabulary-progression", label: "AI Beginner to Advanced Music Video" },
    { value: "music-ai-example-sentences", label: "AI Example Sentences Music Video" },
  ],
};

const RANDOM_GENERATORS = {
  text: {
    ai: ["fun-post", "word-quiz", "language-tip", "false-friends", "daily-challenge", "relatable-learner", "tiered-vocabulary", "example-sentences"],
  },
  image: {
    self: ["word-of-the-day", "word-of-the-day-poster"],
    ai: ["ai-word-of-the-day", "ai-mini-quiz", "ai-false-friends", "ai-daily-challenge", "ai-vocabulary-progression", "ai-example-sentences"],
  },
  video: {
    ai: ["ai-word-of-the-day-video"],
    self: ["confused-words-video"],
    img: ["music-word-of-the-day", "music-word-of-the-day-poster", "music-ai-word-of-the-day", "music-ai-mini-quiz", "music-ai-false-friends", "music-ai-daily-challenge", "music-ai-vocabulary-progression", "music-ai-example-sentences"],
  },
} as const;

const LEGACY_RANDOM_INCLUDES: Record<string, Partial<RandomIncludes>> = {
  "random-content": {},
  "random-text": { text: ["ai"] },
  "random-image": { image: ["self", "ai"] },
  "random-ai-image": { image: ["ai"] },
  "random-no-ai-image": { image: ["self"] },
  "random-video": { video: ["ai", "self", "img"] },
  "random-image-to-video": { video: ["img"] },
  "random-ai-video": { video: ["ai", "self", "img"] },
};

function unique<T>(items: readonly T[]) {
  return [...new Set(items)];
}

export function defaultRandomIncludes<C extends AutomationContentType>(contentType: C): RandomInclude<C>[] {
  return RANDOM_INCLUDE_OPTIONS[contentType].map((option) => option.value) as RandomInclude<C>[];
}

export function normalizeRandomIncludes<C extends AutomationContentType>(contentType: C, includes: readonly string[] | undefined): RandomInclude<C>[] {
  const allowed = new Set<string>(defaultRandomIncludes(contentType));
  const normalized = unique((includes ?? []).filter((include): include is RandomInclude<C> => allowed.has(include)));
  return normalized.length ? normalized : defaultRandomIncludes(contentType);
}

export function isRandomGenerator(generator: string) {
  return generator === RANDOM_GENERATOR || generator in LEGACY_RANDOM_INCLUDES;
}

export function normalizeGeneratorMode(contentType: AutomationContentType, generator: string) {
  return isRandomGenerator(generator) ? RANDOM_GENERATOR : generator;
}

export function resolveRandomIncludes<C extends AutomationContentType>(contentType: C, generator: string, includes: readonly string[] | undefined): RandomInclude<C>[] {
  if (generator === RANDOM_GENERATOR) return normalizeRandomIncludes(contentType, includes);
  const legacy = LEGACY_RANDOM_INCLUDES[generator]?.[contentType];
  return legacy ? normalizeRandomIncludes(contentType, legacy) : normalizeRandomIncludes(contentType, includes);
}

export function randomGeneratorsFor<C extends AutomationContentType>(contentType: C, includes: readonly string[] | undefined) {
  const generatorsByInclude = RANDOM_GENERATORS[contentType] as Record<string, readonly string[]>;
  return normalizeRandomIncludes(contentType, includes).flatMap((include) => generatorsByInclude[include] ?? []);
}

export function resolveGeneratorSelection<C extends AutomationContentType>(contentType: C, generator: string, includes: readonly string[] | undefined, random = Math.random) {
  if (!isRandomGenerator(generator)) return generator;
  const candidates = randomGeneratorsFor(contentType, resolveRandomIncludes(contentType, generator, includes));
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]!;
}
