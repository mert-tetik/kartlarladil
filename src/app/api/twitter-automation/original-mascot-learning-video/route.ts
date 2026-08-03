import { z } from "zod";
import { VOCABULARY_CARDS } from "@/data/cards";
import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import type { OriginalMascotLearningVideoPayload } from "@/features/twitter-automation/original-mascot-learning-video";
import { generatePoyoSpeechDataUrls, PoyoSpeechError } from "@/features/twitter-automation/poyo-speech";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSocialStudioPoyoClient, SOCIAL_CONTENT_CREATIVE_MODEL } from "@/features/twitter-automation/social-studio-poyo";
import type { LanguageCode } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LANGUAGE_CODES = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"] as const;
const requestSchema = z.object({
  mode: z.enum(["tier-progression-video", "vocabulary-quiz-video", "sentence-check-video"]),
  language: z.enum(LANGUAGE_CODES),
  nativeLanguage: z.enum(LANGUAGE_CODES),
});

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  tr: "Turkish", en: "English", de: "German", ru: "Russian", fr: "French", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ar: "Arabic", ja: "Japanese", ko: "Korean", "zh-CN": "Chinese",
};

type ProgressionPlan = {
  caption: string;
  terms: Array<{ tier: "A1" | "B1" | "C1"; term: string }>;
  narration: Array<{ text: string; voice: "native" | "learning"; activeTier: "A1" | "B1" | "C1" | null }>;
};

type QuizPlan = { caption: string; question: string; prompt: string; reveal: string; explanation: string };
type SentencePlan = { caption: string; sentence: string; isCorrect: boolean; correction: string; question: string; reveal: string; explanation: string };

function shuffle<T>(items: readonly T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() && value.trim().length <= maxLength ? value.trim() : null;
}

function extractJsonObject(value: string) {
  const trimmed = value.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : trimmed;
}

export function parseProgressionPlan(value: string): ProgressionPlan | null {
  try {
    const parsed = JSON.parse(extractJsonObject(value)) as { caption?: unknown; terms?: unknown; narration?: unknown };
    const caption = cleanText(parsed.caption, 400);
    if (!caption || !Array.isArray(parsed.terms) || !Array.isArray(parsed.narration) || parsed.terms.length !== 3 || parsed.narration.length < 4 || parsed.narration.length > 8) return null;
    const terms = parsed.terms.map((entry) => {
      const item = entry as { tier?: unknown; term?: unknown };
      const term = cleanText(item?.term, 80);
      return term && (item?.tier === "A1" || item?.tier === "B1" || item?.tier === "C1") ? { tier: item.tier, term } : null;
    });
    const narration = parsed.narration.map((entry) => {
      const item = entry as { text?: unknown; voice?: unknown; activeTier?: unknown };
      const text = cleanText(item?.text, 220);
      const activeTier = item?.activeTier === "A1" || item?.activeTier === "B1" || item?.activeTier === "C1" ? item.activeTier : item?.activeTier === null ? null : undefined;
      return text && (item?.voice === "native" || item?.voice === "learning") && activeTier !== undefined ? { text, voice: item.voice, activeTier } : null;
    });
    if (terms.some((term) => !term) || narration.some((scene) => !scene)) return null;
    const resolvedTerms = terms as Array<{ tier: "A1" | "B1" | "C1"; term: string }>;
    const resolvedNarration = narration as ProgressionPlan["narration"];
    if (new Set(resolvedTerms.map((term) => term.tier)).size !== 3 || new Set(resolvedTerms.map((term) => term.term.toLocaleLowerCase())).size !== 3) return null;
    if (!resolvedNarration.some((scene) => scene.activeTier === "A1") || !resolvedNarration.some((scene) => scene.activeTier === "B1") || !resolvedNarration.some((scene) => scene.activeTier === "C1")) return null;
    return { caption, terms: resolvedTerms, narration: resolvedNarration };
  } catch {
    return null;
  }
}

export function parseQuizPlan(value: string): QuizPlan | null {
  try {
    const parsed = JSON.parse(extractJsonObject(value)) as Record<string, unknown>;
    const caption = cleanText(parsed.caption, 400);
    const question = cleanText(parsed.question, 180);
    const prompt = cleanText(parsed.prompt, 160);
    const reveal = cleanText(parsed.reveal, 180);
    const explanation = cleanText(parsed.explanation, 260);
    return caption && question && prompt && reveal && explanation ? { caption, question, prompt, reveal, explanation } : null;
  } catch {
    return null;
  }
}

export function parseSentencePlan(value: string): SentencePlan | null {
  try {
    const parsed = JSON.parse(extractJsonObject(value)) as Record<string, unknown>;
    const caption = cleanText(parsed.caption, 400);
    const sentence = cleanText(parsed.sentence, 220);
    const correction = cleanText(parsed.correction, 220) ?? "";
    const question = cleanText(parsed.question, 180);
    const reveal = cleanText(parsed.reveal, 180);
    const explanation = cleanText(parsed.explanation, 300);
    return caption && sentence && typeof parsed.isCorrect === "boolean" && question && reveal && explanation && (parsed.isCorrect || correction) ? { caption, sentence, isCorrect: parsed.isCorrect, correction, question, reveal, explanation } : null;
  } catch {
    return null;
  }
}

async function createPlan<T>(instructions: string, input: Record<string, unknown>, parse: (value: string) => T | null) {
  const poyo = createSocialStudioPoyoClient();
  const generate = async (repair: boolean) => {
    const response = await poyo.responses.create({
      model: SOCIAL_CONTENT_CREATIVE_MODEL,
      instructions: `${instructions}${repair ? "\nYour previous response was invalid. Return one valid JSON object with every requested field." : ""}`,
      input: JSON.stringify(input),
      max_output_tokens: 900,
      reasoning: { effort: "none" },
      store: false,
      text: { format: { type: "text" }, verbosity: "low" },
    });
    return parse(extractResponseOutputText(response));
  };
  return await generate(false) ?? await generate(true);
}

async function createProgressionPayload(language: LanguageCode, nativeLanguage: LanguageCode): Promise<OriginalMascotLearningVideoPayload | null> {
  const plan = await createPlan(
    [
      "Create an A1-to-C1 vocabulary progression for a FoxiesDeck vertical learning video.",
      "Return one JSON object only: { caption, terms, narration }.",
      "terms must contain exactly three distinct, semantically connected target-language words in this exact tier set: A1, B1, C1. They should express the same broad idea with increasingly precise or advanced vocabulary.",
      "narration must contain 4 to 8 objects: { text, voice, activeTier }. voice is native or learning; activeTier is A1, B1, C1, or null. Include each tier as an activeTier at least once. Use learning voice only for the target words; native voice explains the distinction naturally.",
      "caption is a concise native-language social caption with 2 or 3 relevant hashtags. Keep every spoken text brief and natural.",
    ].join("\n"),
    { learningLanguage: LANGUAGE_NAMES[language], nativeLanguage: LANGUAGE_NAMES[nativeLanguage] },
    parseProgressionPlan,
  );
  if (!plan) return null;
  const audioDataUrls = await generatePoyoSpeechDataUrls(plan.narration.map((scene) => ({ text: scene.text, language: scene.voice === "learning" ? language : nativeLanguage, speed: 1 })));
  return {
    mode: "tier-progression-video",
    caption: plan.caption,
    scenes: plan.narration.map((scene, index) => ({ kind: "progression", subtitle: scene.text, terms: plan.terms, activeTier: scene.activeTier, audioDataUrl: audioDataUrls[index]! })),
  };
}

function selectQuizCards(language: LanguageCode, nativeLanguage: LanguageCode) {
  const candidates = shuffle(VOCABULARY_CARDS.filter((card) => card.language === language && card.termKind === "word"));
  const card = candidates.find((candidate) => Boolean(candidate.translations[nativeLanguage] || candidate.translation));
  if (!card) return null;
  const correctMeaning = card.translations[nativeLanguage] || card.translation;
  const distractors = candidates
    .filter((candidate) => candidate.sourceKey !== card.sourceKey)
    .map((candidate) => candidate.translations[nativeLanguage] || candidate.translation)
    .filter((meaning) => meaning && meaning.toLocaleLowerCase() !== correctMeaning.toLocaleLowerCase());
  const uniqueDistractors = [...new Set(distractors.map((meaning) => meaning.trim()))].slice(0, 3);
  if (uniqueDistractors.length !== 3) return null;
  const options = shuffle([correctMeaning, ...uniqueDistractors]);
  return { card, options, correctIndex: options.findIndex((option) => option === correctMeaning) };
}

async function createQuizPayload(language: LanguageCode, nativeLanguage: LanguageCode): Promise<OriginalMascotLearningVideoPayload | null> {
  const quiz = selectQuizCards(language, nativeLanguage);
  if (!quiz || quiz.correctIndex < 0) return null;
  const plan = await createPlan(
    [
      "Create a concise native-language narration plan for a FoxiesDeck vocabulary quiz video.",
      "Return one JSON object only: { caption, question, prompt, reveal, explanation }.",
      "question asks what the target-language word means but does not repeat it. prompt asks the viewer to choose. reveal states the correct native-language meaning. explanation briefly explains the word using the supplied example.",
      "caption has 2 or 3 relevant hashtags. Keep all spoken values brief, natural, and easy to understand.",
    ].join("\n"),
    { nativeLanguage: LANGUAGE_NAMES[nativeLanguage], learningLanguage: LANGUAGE_NAMES[language], word: quiz.card.term, meaning: quiz.options[quiz.correctIndex], example: quiz.card.examples[0]?.sentence ?? quiz.card.example },
    parseQuizPlan,
  );
  if (!plan) return null;
  const spoken = [
    { text: plan.question, language: nativeLanguage },
    { text: quiz.card.term, language },
    { text: plan.prompt, language: nativeLanguage },
    { text: plan.reveal, language: nativeLanguage },
    { text: plan.explanation, language: nativeLanguage },
  ];
  const audioDataUrls = await generatePoyoSpeechDataUrls(spoken);
  const base = { kind: "quiz" as const, term: quiz.card.term, tier: quiz.card.tier, options: quiz.options, correctIndex: quiz.correctIndex };
  return {
    mode: "vocabulary-quiz-video",
    caption: plan.caption,
    scenes: [
      { ...base, phase: "question", subtitle: plan.question, audioDataUrl: audioDataUrls[0]! },
      { ...base, phase: "question", subtitle: quiz.card.term, audioDataUrl: audioDataUrls[1]! },
      { ...base, phase: "question", subtitle: plan.prompt, audioDataUrl: audioDataUrls[2]! },
      { ...base, phase: "countdown", subtitle: plan.prompt, durationSeconds: 4 },
      { ...base, phase: "reveal", subtitle: plan.reveal, audioDataUrl: audioDataUrls[3]! },
      { ...base, phase: "explanation", subtitle: plan.explanation, audioDataUrl: audioDataUrls[4]! },
    ],
  };
}

async function createSentencePayload(language: LanguageCode, nativeLanguage: LanguageCode): Promise<OriginalMascotLearningVideoPayload | null> {
  const plan = await createPlan(
    [
      "Create a concise FoxiesDeck grammar judgment video plan.",
      "Return one JSON object only: { caption, sentence, isCorrect, correction, question, reveal, explanation }.",
      "sentence is a short, useful sentence in the selected learning language. Randomly make it either deceptively correct or genuinely incorrect. isCorrect must match it. correction is empty when correct, otherwise the corrected learning-language sentence.",
      "question, reveal, and explanation are in the selected native language. question asks if the sentence is correct. reveal clearly says correct or incorrect. explanation clearly explains why. caption has 2 or 3 relevant hashtags.",
    ].join("\n"),
    { learningLanguage: LANGUAGE_NAMES[language], nativeLanguage: LANGUAGE_NAMES[nativeLanguage] },
    parseSentencePlan,
  );
  if (!plan) return null;
  const spoken = [
    { text: plan.sentence, language },
    { text: plan.question, language: nativeLanguage },
    { text: plan.reveal, language: nativeLanguage },
    { text: plan.explanation, language: nativeLanguage },
  ];
  const audioDataUrls = await generatePoyoSpeechDataUrls(spoken);
  const base = { kind: "sentence" as const, sentence: plan.sentence, isCorrect: plan.isCorrect, correction: plan.correction || null };
  return {
    mode: "sentence-check-video",
    caption: plan.caption,
    scenes: [
      { ...base, phase: "question", subtitle: plan.sentence, audioDataUrl: audioDataUrls[0]! },
      { ...base, phase: "question", subtitle: plan.question, audioDataUrl: audioDataUrls[1]! },
      { ...base, phase: "countdown", subtitle: plan.question, durationSeconds: 4 },
      { ...base, phase: "reveal", subtitle: plan.reveal, audioDataUrl: audioDataUrls[2]! },
      { ...base, phase: "explanation", subtitle: plan.explanation, audioDataUrl: audioDataUrls[3]! },
    ],
  };
}

export async function POST(request: Request) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) return Response.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  if (!process.env.POYO_API_KEY?.trim()) return Response.json({ errorCode: "poyo_not_configured" }, { status: 503 });

  const { mode, language, nativeLanguage } = parsed.data;
  try {
    const payload = mode === "tier-progression-video"
      ? await createProgressionPayload(language, nativeLanguage)
      : mode === "vocabulary-quiz-video"
        ? await createQuizPayload(language, nativeLanguage)
        : await createSentencePayload(language, nativeLanguage);
    if (!payload) return Response.json({ errorCode: "invalid_learning_video_plan" }, { status: 502 });
    return Response.json(payload);
  } catch (error) {
    if (error instanceof PoyoSpeechError) return Response.json({ errorCode: error.code }, { status: error.code === "poyo_not_configured" ? 503 : 502 });
    return Response.json({ errorCode: "learning_video_generation_failed" }, { status: 502 });
  }
}
