import { z } from "zod";
import { VOCABULARY_CARDS } from "@/data/cards";
import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import type { OriginalMascotLearningVideoPayload } from "@/features/twitter-automation/original-mascot-learning-video";
import { parseProgressionPlan, parseQuizPlan, parseSentencePlan } from "@/features/twitter-automation/original-mascot-learning-video-plan";
import { generatePoyoSpeechDataUrls, PoyoSpeechError } from "@/features/twitter-automation/poyo-speech";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSocialStudioPoyoClient, generateSocialStudioTextWithFallback, PoyoResponsesProviderError, SOCIAL_CONTENT_CREATIVE_MODEL } from "@/features/twitter-automation/social-studio-poyo";
import { createSocialStudioDiagnostic } from "@/features/twitter-automation/social-studio-diagnostics";
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

function shuffle<T>(items: readonly T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

async function createPlan<T>(instructions: string, input: Record<string, unknown>, parse: (value: string) => T | null) {
  const poyo = createSocialStudioPoyoClient();
  const generate = async (repair: boolean) => {
    const { output } = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_CREATIVE_MODEL,
      (model) => poyo.responses.create({
      model,
      instructions: `${instructions}${repair ? "\nYour previous response was invalid. Return one valid JSON object with every requested field." : ""}`,
      input: JSON.stringify(input),
      max_output_tokens: 900,
      reasoning: { effort: "none" },
      store: false,
      text: { format: { type: "text" }, verbosity: "low" },
      }),
      extractResponseOutputText,
    );
    return parse(output);
  };
  let lastError: unknown;
  // Each provider call has a bounded primary-to-fallback window. A second
  // repair round can push browser video generation beyond Vercel's request
  // deadline, so the strict prompt gets one complete attempt per request.
  for (const repair of [false]) {
    try {
      const plan = await generate(repair);
      if (plan) return plan;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return null;
}

async function createProgressionPayload(language: LanguageCode, nativeLanguage: LanguageCode): Promise<OriginalMascotLearningVideoPayload | null> {
  const plan = await createPlan(
    [
      "Create an A1-to-C1 vocabulary progression for a FoxiesDeck vertical learning video.",
      "Return one JSON object only: { caption, terms, narration }.",
      "terms must contain exactly three distinct, semantically connected target-language words in this exact tier set: A1, B1, C1. They should express the same broad idea with increasingly precise or advanced vocabulary.",
      "narration must contain exactly 8 objects with { text, phase, activeTier } in this exact order: intro/null, term/A1, explanation/A1, term/B1, explanation/B1, term/C1, explanation/C1, outro/null.",
      "For every term phase, text must be the exact target-language word for that tier. intro is a native-language hook of at most 6 words introducing the A1-to-C1 comparison. Each explanation phase must explain that word naturally in the native language. outro is a native-language closing that briefly summarizes the progression and encourages the viewer to use the more precise word when appropriate.",
      "caption is a concise native-language social caption with 2 or 3 relevant hashtags. Keep every spoken text brief and natural.",
    ].join("\n"),
    { learningLanguage: LANGUAGE_NAMES[language], nativeLanguage: LANGUAGE_NAMES[nativeLanguage] },
    parseProgressionPlan,
  );
  if (!plan) return null;
  const spokenScenes = plan.narration.map((scene) => {
    const term = scene.activeTier ? plan.terms.find((entry) => entry.tier === scene.activeTier)?.term : null;
    return {
      ...scene,
      text: scene.phase === "term" && term ? term : scene.text,
      language: scene.phase === "term" ? language : nativeLanguage,
      mascot: scene.phase === "term" ? pick(["mascot4", "mascot18"] as const) : "original" as const,
    };
  });
  const audioDataUrls = await generatePoyoSpeechDataUrls(spokenScenes.map((scene) => ({ text: scene.text, language: scene.language, speed: 1 })));
  return {
    mode: "tier-progression-video",
    caption: plan.caption,
    scenes: spokenScenes.map((scene, index) => ({ kind: "progression", subtitle: scene.text, terms: plan.terms, activeTier: scene.activeTier, mascot: scene.mascot, audioDataUrl: audioDataUrls[index]! })),
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
    if (!payload) return Response.json({
      errorCode: "invalid_learning_video_plan",
      diagnostic: createSocialStudioDiagnostic({
        stage: "A1 to C1 plan validation",
        provider: "PoYo Responses / Terra",
        fallbackDetail: "The provider returned a response, but it did not contain the required A1, B1, C1 plan fields after repair.",
      }),
    }, { status: 502 });
    return Response.json(payload);
  } catch (error) {
    if (error instanceof PoyoSpeechError) return Response.json({
      errorCode: error.code,
      diagnostic: createSocialStudioDiagnostic({ stage: "PoYo ElevenLabs TTS", provider: "PoYo Generate", error, fallbackDetail: "The voice task could not be completed." }),
    }, { status: error.code === "poyo_not_configured" ? 503 : 502 });
    return Response.json({
      errorCode: error instanceof PoyoResponsesProviderError ? "poyo_responses_provider_error" : "learning_video_generation_failed",
      diagnostic: createSocialStudioDiagnostic({
        stage: "A1 to C1 script plan",
        provider: "PoYo Responses / Terra",
        error,
        fallbackDetail: "The script-planning request failed before voices could be created.",
      }),
    }, { status: 502 });
  }
}
