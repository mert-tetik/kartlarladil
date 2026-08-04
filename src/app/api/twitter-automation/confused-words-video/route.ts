import { z } from "zod";
import { LOCALE_CODES } from "@/data/languages";
import { VOCABULARY_CARDS } from "@/data/cards";
import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import { buildCreateCardInput, buildCreateCardInstructions } from "@/features/cards/create-card-prompts";
import { generatedCardSchema, matchesRequestedTargetLanguage, type GeneratedCardResponse } from "@/features/cards/create-card-schema";
import { generatePoyoSpeechDataUrls, PoyoSpeechError } from "@/features/twitter-automation/poyo-speech";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSocialStudioPoyoClient, SOCIAL_CONTENT_CREATIVE_MODEL } from "@/features/twitter-automation/social-studio-poyo";
import type { LanguageCode, LocaleCode, Tier, VocabularyCard } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PHASE_COUNT = 3;

const requestSchema = z.object({
  language: z.enum(["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"]),
  nativeLanguage: z.enum(["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"]),
  tier: z.enum(["A1", "A2", "B1", "B2", "C1"]),
});

type ConfusedWordsPhasePlan = {
  firstTerm: string;
  secondTerm: string;
  firstMeaningTail: string;
  secondMeaningTail: string;
  connector: string;
  question: string;
};

type ConfusedWordsPlan = {
  phases: ConfusedWordsPhasePlan[];
  caption: string;
};

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  tr: "Turkish", en: "English", de: "German", ru: "Russian", fr: "French", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ar: "Arabic", ja: "Japanese", ko: "Korean", "zh-CN": "Chinese",
};

function extractJsonObject(value: string) {
  const trimmed = value.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : trimmed;
}

function parsePhase(value: unknown): ConfusedWordsPhasePlan | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const field = (name: keyof ConfusedWordsPhasePlan) => typeof record[name] === "string" ? record[name].trim() : "";
  const firstTerm = field("firstTerm");
  const secondTerm = field("secondTerm");
  const connector = field("connector");
  const question = field("question");
  const firstMeaningTail = field("firstMeaningTail");
  const secondMeaningTail = field("secondMeaningTail");
  if (
    firstTerm.length < 2 || secondTerm.length < 2 || /\s/u.test(firstTerm) || /\s/u.test(secondTerm) || normalizeTerm(firstTerm) === normalizeTerm(secondTerm)
    || connector.length < 1 || question.length < 4 || firstMeaningTail.length < 4 || secondMeaningTail.length < 4
  ) return null;
  return {
    firstTerm: firstTerm.slice(0, 80),
    secondTerm: secondTerm.slice(0, 80),
    connector: connector.slice(0, 40),
    question: question.slice(0, 120),
    firstMeaningTail: firstMeaningTail.slice(0, 180),
    secondMeaningTail: secondMeaningTail.slice(0, 180),
  };
}

function parsePlan(value: string): ConfusedWordsPlan | null {
  try {
    const parsed = JSON.parse(extractJsonObject(value)) as { phases?: unknown; caption?: unknown };
    const phases = Array.isArray(parsed.phases) ? parsed.phases.map(parsePhase) : [];
    const caption = typeof parsed.caption === "string" ? parsed.caption.trim() : "";
    if (phases.length !== PHASE_COUNT || phases.some((phase) => !phase) || caption.length < 12) return null;
    const resolvedPhases = phases as ConfusedWordsPhasePlan[];
    const terms = resolvedPhases.flatMap((phase) => [normalizeTerm(phase.firstTerm), normalizeTerm(phase.secondTerm)]);
    if (new Set(terms).size !== terms.length) return null;
    return { phases: resolvedPhases, caption: caption.slice(0, 400) };
  } catch {
    return null;
  }
}

function normalizeTerm(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("en").trim();
}

function getCandidateCards(language: LanguageCode) {
  return VOCABULARY_CARDS
    .filter((card) => card.language === language && card.termKind === "word" && !/\s/u.test(card.term))
    .sort(() => Math.random() - 0.5)
    .slice(0, 96);
}

function findCandidateCard(language: LanguageCode, term: string) {
  const normalizedTerm = normalizeTerm(term);
  return VOCABULARY_CARDS.find((candidate) => candidate.language === language && candidate.termKind === "word" && normalizeTerm(candidate.term) === normalizedTerm) ?? null;
}

async function createPlan(language: LanguageCode, nativeLanguage: LanguageCode, tier: Tier, candidateCards: readonly VocabularyCard[]) {
  const instructions = [
    "Create a FoxiesDeck vertical short-video plan with exactly three phases about commonly confused or very-close-in-meaning vocabulary words.",
    "Return one JSON object only, with exactly: phases, caption. phases must contain exactly three objects. Each phase object must contain exactly: firstTerm, secondTerm, connector, question, firstMeaningTail, secondMeaningTail.",
    "Every phase needs two real, distinct single words in the requested learning language. All six terms across the plan must be different. Prefer a useful pair from candidateTerms, but you may choose a real word outside that list when it makes a more useful commonly-confused pair. Never invent words, use translations, use inflections of the same word, or choose an unrelated pair.",
    "connector is only the native-language equivalent of 'and'. question is the native-language equivalent of 'what is the difference between them?'.",
    "firstMeaningTail is a native-language phrase that follows the first term and means '[its meaning] while,'; do not repeat the first term. secondMeaningTail is a native-language phrase that follows the second term and means '[its meaning].'; do not repeat the second term.",
    "caption is one ready-to-post native-language caption under 260 characters, with an inviting hook and 2 or 3 relevant hashtags including #languagelearning.",
    "Use natural punctuation for speech. Keep every spoken fragment brief and easy to understand.",
  ].join("\n");
  const input = {
    learningLanguage: LANGUAGE_NAMES[language],
    nativeLanguage: LANGUAGE_NAMES[nativeLanguage],
    requestedTier: tier,
    candidateTerms: candidateCards.map((card) => card.term),
  };
  const poyo = createSocialStudioPoyoClient();
  const generate = async (repair: boolean) => {
    const response = await poyo.responses.create({
      model: SOCIAL_CONTENT_CREATIVE_MODEL,
      instructions: repair ? `${instructions}\nYour previous response was invalid. Return valid JSON with all exact fields and three phases.` : instructions,
      input: JSON.stringify(input),
      max_output_tokens: 1_200,
      reasoning: { effort: "none" },
      store: false,
      text: { format: { type: "text" }, verbosity: "low" },
    });
    return parsePlan(extractResponseOutputText(response));
  };
  return await generate(false) ?? await generate(true);
}

function toStudioCustomCard(generated: GeneratedCardResponse): VocabularyCard {
  const sourceKey = `social-studio:${generated.language}:${encodeURIComponent(generated.term).replace(/%/gu, "-")}`;
  const translations = Object.fromEntries(LOCALE_CODES.map((locale) => [locale, generated.translations[locale]!])) as VocabularyCard["translations"];
  const grammar = { summary: "", rules: generated.grammar, details: [] };
  const grammarByLocale = Object.fromEntries(LOCALE_CODES.map((locale) => [locale, grammar])) as unknown as VocabularyCard["grammarByLocale"];
  return {
    id: sourceKey,
    sourceKey,
    englishKey: translations.en,
    language: generated.language,
    tier: generated.tier,
    termKind: generated.termKind,
    term: generated.term,
    translation: translations.en,
    translations,
    translationMeaningsByLocale: Object.fromEntries(LOCALE_CODES.map((locale) => [locale, [translations[locale]]])) as VocabularyCard["translationMeaningsByLocale"],
    pronunciation: generated.pronunciation,
    partOfSpeech: generated.partOfSpeech,
    example: generated.example,
    exampleTranslation: generated.exampleTranslation,
    examples: [{
      id: `${sourceKey}:example:0`, context: "natural", label: "Natural", sentence: generated.example, translation: generated.exampleTranslation,
      translations: Object.fromEntries(LOCALE_CODES.map((locale) => [locale, locale === "en" ? generated.exampleTranslation : generated.exampleTranslation])) as VocabularyCard["examples"][number]["translations"],
    }],
    grammar,
    grammarByLocale,
  };
}

async function createStudioCustomCard(term: string, language: LanguageCode, nativeLanguage: LocaleCode) {
  const poyo = createSocialStudioPoyoClient();
  const response = await poyo.responses.create({
    model: SOCIAL_CONTENT_CREATIVE_MODEL,
    instructions: buildCreateCardInstructions({ locale: nativeLanguage, targetLanguage: language }),
    input: buildCreateCardInput({ locale: nativeLanguage, term, targetLanguage: language }),
    max_output_tokens: 700,
    reasoning: { effort: "minimal" },
    store: false,
    text: { format: { type: "text" }, verbosity: "low" },
  });
  const generated = generatedCardSchema.safeParse(JSON.parse(extractJsonObject(extractResponseOutputText(response))));
  if (!generated.success || !matchesRequestedTargetLanguage(generated.data, language)) throw new Error("custom_card_generation_failed");
  return toStudioCustomCard(generated.data);
}

async function resolveCards(plan: ConfusedWordsPlan, language: LanguageCode, nativeLanguage: LocaleCode) {
  const resolved = new Map<string, VocabularyCard>();
  for (const term of plan.phases.flatMap((phase) => [phase.firstTerm, phase.secondTerm])) {
    const key = normalizeTerm(term);
    const existing = findCandidateCard(language, term);
    resolved.set(key, existing ?? await createStudioCustomCard(term, language, nativeLanguage));
  }
  return plan.phases.map((phase) => ({
    first: resolved.get(normalizeTerm(phase.firstTerm))!,
    second: resolved.get(normalizeTerm(phase.secondTerm))!,
  }));
}

async function generateSceneSpeechInBatches(
  scenes: ReadonlyArray<{ text: string; language: LanguageCode; speechSpeed: number }>,
) {
  const audioDataUrls: string[] = [];
  // Eight concurrent jobs is the already-proven size of the original video.
  // Sending all 24 to PoYo at once can cause an upstream 502/rate-limit.
  for (let index = 0; index < scenes.length; index += 8) {
    const batch = scenes.slice(index, index + 8);
    audioDataUrls.push(...await generatePoyoSpeechDataUrls(batch.map(({ text, language, speechSpeed }) => ({ text, language, speed: speechSpeed }))));
  }
  return audioDataUrls;
}

export async function POST(request: Request) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) return Response.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  if (!process.env.POYO_API_KEY?.trim()) return Response.json({ errorCode: "poyo_not_configured" }, { status: 503 });

  let plan: ConfusedWordsPlan | null;
  try {
    plan = await createPlan(parsed.data.language, parsed.data.nativeLanguage, parsed.data.tier, getCandidateCards(parsed.data.language));
  } catch {
    return Response.json({ errorCode: "confused_words_plan_failed" }, { status: 502 });
  }
  if (!plan) return Response.json({ errorCode: "invalid_confused_words_plan" }, { status: 502 });

  let cards: Array<{ first: VocabularyCard; second: VocabularyCard }>;
  try {
    cards = await resolveCards(plan, parsed.data.language, parsed.data.nativeLanguage);
  } catch {
    return Response.json({ errorCode: "custom_card_generation_failed" }, { status: 502 });
  }

  const sceneDefinitions = plan.phases.flatMap((phase, phaseIndex) => [
    { phaseIndex, text: phase.firstTerm, language: parsed.data.language, mascot: 18 as const, mirrored: true, speechSpeed: 1, playbackRate: 1 },
    { phaseIndex, text: phase.connector, language: parsed.data.nativeLanguage, mascot: 18 as const, mirrored: true, speechSpeed: 1.1, playbackRate: 1.25 / 1.1 },
    { phaseIndex, text: phase.secondTerm, language: parsed.data.language, mascot: 18 as const, mirrored: false, speechSpeed: 1, playbackRate: 1 },
    { phaseIndex, text: phase.question, language: parsed.data.nativeLanguage, mascot: 3 as const, mirrored: false, speechSpeed: 1.1, playbackRate: 1.25 / 1.1 },
    { phaseIndex, text: phase.firstTerm, language: parsed.data.language, mascot: 4 as const, mirrored: true, speechSpeed: 1, playbackRate: 1 },
    { phaseIndex, text: phase.firstMeaningTail, language: parsed.data.nativeLanguage, mascot: 4 as const, mirrored: true, speechSpeed: 1.1, playbackRate: 1.25 / 1.1 },
    { phaseIndex, text: phase.secondTerm, language: parsed.data.language, mascot: 4 as const, mirrored: false, speechSpeed: 1, playbackRate: 1 },
    { phaseIndex, text: phase.secondMeaningTail, language: parsed.data.nativeLanguage, mascot: 4 as const, mirrored: false, speechSpeed: 1.1, playbackRate: 1.25 / 1.1 },
  ]);

  try {
    const audioDataUrls = await generateSceneSpeechInBatches(sceneDefinitions);
    return Response.json({
      caption: plan.caption,
      phases: cards,
      scenes: sceneDefinitions.map(({ speechSpeed: _speechSpeed, ...scene }, index) => ({ ...scene, audioDataUrl: audioDataUrls[index]! })),
    });
  } catch (error) {
    if (error instanceof PoyoSpeechError) return Response.json({ errorCode: error.code }, { status: error.code === "poyo_not_configured" ? 503 : 502 });
    return Response.json({ errorCode: "speech_generation_failed" }, { status: 502 });
  }
}
