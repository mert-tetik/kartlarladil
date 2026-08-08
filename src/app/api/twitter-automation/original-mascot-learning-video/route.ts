import { z } from "zod";
import { VOCABULARY_CARDS } from "@/data/cards";
import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import type { OriginalMascotLearningVideoPayload, OriginalMascotLearningVideoScene } from "@/features/twitter-automation/original-mascot-learning-video";
import { parseProgressionPlan, parseQuizPlan, parseSentencePlan, parseSentenceTranslationPlan, type SentenceTranslationPlan } from "@/features/twitter-automation/original-mascot-learning-video-plan";
import { generatePoyoSpeechDataUrls, PoyoSpeechError } from "@/features/twitter-automation/poyo-speech";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSocialStudioPoyoClient, generateSocialStudioTextWithFallback, PoyoResponsesProviderError, SOCIAL_CONTENT_CREATIVE_MODEL } from "@/features/twitter-automation/social-studio-poyo";
import { createSocialStudioDiagnostic } from "@/features/twitter-automation/social-studio-diagnostics";
import { resolveSocialStudioVocabularyCard, selectSocialStudioVocabularyTerms, SocialStudioVocabularyError } from "@/features/twitter-automation/social-studio-vocabulary";
import type { LanguageCode, Tier } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LANGUAGE_CODES = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"] as const;
const CHARACTER_VARIATIONS = ["Animal.png", "Bear.png", "Bunny.png", "Lion.png", "Panda.png", "Racoon.png", "Tiger.png", "Wolf.png"] as const;
const NON_ORIGINAL_VOICE_IDS = [
  "J1lfByWs8gvoooryDWEi",
  "1jR8l3dNgd4OQs6kxgaF",
  "XJ2fW4ybq7HouelYYGcL",
  "IvUJKFyjVb5hItY9dJAT",
  "M5t0724ORuAGCh3p3DUR",
  "nuVIy6kn92EbEZwTlTnc",
  "fBD19tfE58bkETeiwUoC",
  "eppqEXVumQ3CfdndcIBd",
] as const;

const requestSchema = z.object({
  mode: z.enum(["tier-progression-video", "vocabulary-quiz-video", "sentence-check-video", "sentence-translation-video"]),
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
      "Choose the terms yourself, not from a catalogue. Do not use any previously used terms or example lists. The selection must be completely random and must not repeat any term used in previous generations, even when this request runs immediately after another one.",
      "narration must contain exactly 8 objects with { text, phase, activeTier } in this exact order: intro/null, term/A1, explanation/A1, term/B1, explanation/B1, term/C1, explanation/C1, outro/null.",
      "For every term phase, text must be the exact target-language word for that tier. intro is a native-language hook of at most 6 words introducing the A1-to-C1 comparison. Each explanation phase must state the meaning in a single consistent native-language sentence. Begin with the exact target-language word, then give its meaning naturally in native language. Do not use a fixed formula like 'demektir' or 'means' in every language; vary the phrasing naturally.",
      "outro is a native-language closing that briefly summarizes the progression and encourages the viewer to use the more precise word when appropriate.",
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

async function selectThreeQuizCards(language: LanguageCode, nativeLanguage: LanguageCode) {
  const quizTiers: Tier[] = ["A1", "A2", "B1", "B2"];
  const [term1, term2, term3] = await selectSocialStudioVocabularyTerms({
    language,
    nativeLanguage,
    tier: pick(quizTiers),
    count: 3,
    generator: "vocabulary-quiz-video",
  });
  const card1 = await resolveSocialStudioVocabularyCard(term1!, language, nativeLanguage);
  const card2 = await resolveSocialStudioVocabularyCard(term2!, language, nativeLanguage);
  const card3 = await resolveSocialStudioVocabularyCard(term3!, language, nativeLanguage);
  const candidates = shuffle(VOCABULARY_CARDS.filter((card) => card.language === language && card.termKind === "word"));
  const buildQuiz = (card: typeof card1) => {
    const correctMeaning = card.translations[nativeLanguage] || card.translation;
    const distractors = candidates
      .filter((candidate) => candidate.sourceKey !== card.sourceKey)
      .map((candidate) => candidate.translations[nativeLanguage] || candidate.translation)
      .filter((meaning) => meaning && meaning.toLocaleLowerCase() !== correctMeaning.toLocaleLowerCase());
    const uniqueDistractors = [...new Set(distractors.map((meaning) => meaning.trim()))].slice(0, 3);
    if (uniqueDistractors.length !== 3) return null;
    const options = shuffle([correctMeaning, ...uniqueDistractors]);
    return { card, options, correctIndex: options.findIndex((option) => option === correctMeaning) };
  };
  const quiz1 = buildQuiz(card1);
  const quiz2 = buildQuiz(card2);
  const quiz3 = buildQuiz(card3);
  if (!quiz1 || quiz1.correctIndex < 0 || !quiz2 || quiz2.correctIndex < 0 || !quiz3 || quiz3.correctIndex < 0) return null;
  return { quiz1, quiz2, quiz3 };
}

async function createSingleQuizPlan(language: LanguageCode, nativeLanguage: LanguageCode, quiz: { card: typeof VOCABULARY_CARDS[number]; options: string[]; correctIndex: number }) {
  return await createPlan(
    [
      "Create a concise native-language narration plan for a FoxiesDeck vocabulary quiz video.",
      "Return one JSON object only: { caption, question, prompt, reveal, explanation, transition, outro }.",
      "question asks what the target-language word means but does not repeat it. prompt asks the viewer to choose. reveal states the correct answer clearly in native language, for example 'The answer is ...' or equivalent natural phrase. transition is a short native-language phrase connecting two quiz words (e.g. 'And the next word?'). outro asks viewers to write the answer in the comments.",
      "caption has 2 or 3 relevant hashtags. Keep all spoken values brief, natural, and easy to understand.",
      "The selected word must be completely random and must not repeat any word used in previous generations, even when this request runs immediately after another one.",
    ].join("\n"),
    { nativeLanguage: LANGUAGE_NAMES[nativeLanguage], learningLanguage: LANGUAGE_NAMES[language], word: quiz.card.term, meaning: quiz.options[quiz.correctIndex], example: quiz.card.examples[0]?.sentence ?? quiz.card.example },
    parseQuizPlan,
  );
}

function buildQuizScenes(base: { kind: "quiz"; term: string; tier: Tier; options: string[]; correctIndex: number; language: LanguageCode }, plan: NonNullable<Awaited<ReturnType<typeof createSingleQuizPlan>>>, audioDataUrls: string[]) {
  return [
    { ...base, phase: "question" as const, subtitle: plan.question, audioDataUrl: audioDataUrls[0]! },
    { ...base, phase: "question" as const, subtitle: base.term, audioDataUrl: audioDataUrls[1]! },
    { ...base, phase: "question" as const, subtitle: plan.prompt, audioDataUrl: audioDataUrls[2]! },
    { ...base, phase: "countdown" as const, subtitle: plan.prompt, durationSeconds: 6 },
    { ...base, phase: "reveal" as const, subtitle: plan.reveal, audioDataUrl: audioDataUrls[3]! },
  ];
}

function buildFinalQuizScenes(base: { kind: "quiz"; term: string; tier: Tier; options: string[]; correctIndex: number; language: LanguageCode }, plan: NonNullable<Awaited<ReturnType<typeof createSingleQuizPlan>>>, audioDataUrls: string[]) {
  return [
    { ...base, phase: "question" as const, subtitle: plan.question, audioDataUrl: audioDataUrls[0]! },
    { ...base, phase: "question" as const, subtitle: base.term, audioDataUrl: audioDataUrls[1]! },
    { ...base, phase: "question" as const, subtitle: plan.prompt, audioDataUrl: audioDataUrls[2]! },
    { ...base, phase: "countdown" as const, subtitle: plan.prompt, durationSeconds: 6 },
  ];
}

async function createQuizPayload(language: LanguageCode, nativeLanguage: LanguageCode): Promise<OriginalMascotLearningVideoPayload | null> {
  const selected = await selectThreeQuizCards(language, nativeLanguage);
  if (!selected) return null;
  const { quiz1, quiz2, quiz3 } = selected;
  const plan1 = await createSingleQuizPlan(language, nativeLanguage, quiz1);
  const plan2 = await createSingleQuizPlan(language, nativeLanguage, quiz2);
  const plan3 = await createSingleQuizPlan(language, nativeLanguage, quiz3);
  if (!plan1 || !plan2 || !plan3) return null;
  const spoken1 = [
    { text: plan1.question, language: nativeLanguage },
    { text: quiz1.card.term, language },
    { text: plan1.prompt, language: nativeLanguage },
    { text: plan1.reveal, language: nativeLanguage },
  ];
  const spoken2 = [
    { text: plan2.question, language: nativeLanguage },
    { text: quiz2.card.term, language },
    { text: plan2.prompt, language: nativeLanguage },
    { text: plan2.reveal, language: nativeLanguage },
  ];
  const spoken3 = [
    { text: plan3.question, language: nativeLanguage },
    { text: quiz3.card.term, language },
    { text: plan3.prompt, language: nativeLanguage },
  ];
  const transitionSpoken1 = plan1.transition;
  const transitionSpoken2 = plan2.transition;
  const outroSpoken = plan3.outro;
  const [audioDataUrls1, audioDataUrls2, audioDataUrls3, transitionAudio1, transitionAudio2, outroAudio] = await Promise.all([
    generatePoyoSpeechDataUrls(spoken1),
    generatePoyoSpeechDataUrls(spoken2),
    generatePoyoSpeechDataUrls(spoken3),
    generatePoyoSpeechDataUrls([{ text: transitionSpoken1, language: nativeLanguage }]),
    generatePoyoSpeechDataUrls([{ text: transitionSpoken2, language: nativeLanguage }]),
    generatePoyoSpeechDataUrls([{ text: outroSpoken, language: nativeLanguage }]),
  ]);
  const base1 = { kind: "quiz" as const, term: quiz1.card.term, tier: quiz1.card.tier, options: quiz1.options, correctIndex: quiz1.correctIndex, language };
  const base2 = { kind: "quiz" as const, term: quiz2.card.term, tier: quiz2.card.tier, options: quiz2.options, correctIndex: quiz2.correctIndex, language };
  const base3 = { kind: "quiz" as const, term: quiz3.card.term, tier: quiz3.card.tier, options: quiz3.options, correctIndex: quiz3.correctIndex, language };
  const transitionScene1 = { kind: "quiz" as const, phase: "question" as const, term: "", tier: "A1" as const, options: [], correctIndex: -1, language: nativeLanguage, subtitle: transitionSpoken1, audioDataUrl: transitionAudio1[0]! };
  const transitionScene2 = { kind: "quiz" as const, phase: "question" as const, term: "", tier: "A1" as const, options: [], correctIndex: -1, language: nativeLanguage, subtitle: transitionSpoken2, audioDataUrl: transitionAudio2[0]! };
  const outroScene = { kind: "outro" as const, lines: [plan3.outro], subtitle: "", audioDataUrl: outroAudio[0]! };
  return {
    mode: "vocabulary-quiz-video",
    caption: `${plan1.caption}\n\n${plan2.caption}\n\n${plan3.caption}`,
    scenes: [
      ...buildQuizScenes(base1, plan1, audioDataUrls1),
      transitionScene1,
      ...buildQuizScenes(base2, plan2, audioDataUrls2),
      transitionScene2,
      ...buildFinalQuizScenes(base3, plan3, audioDataUrls3),
      outroScene,
    ],
  };
}

async function createSingleSentencePlan(language: LanguageCode, nativeLanguage: LanguageCode) {
  return await createPlan(
    [
      "Create a concise FoxiesDeck grammar judgment video plan.",
      "Return one JSON object only: { caption, sentence, isCorrect, correction, question, reveal, explanation, intro, outro }.",
      "sentence is a short, useful sentence in the selected learning language. Randomly make it either deceptively correct or genuinely incorrect. isCorrect must match it. correction is empty when correct, otherwise the corrected learning-language sentence.",
      "question, reveal, intro, and outro are in the selected native language. question asks if the sentence is correct. reveal must be a single native-language word only: the word for 'correct' when isCorrect is true, or the word for 'incorrect' when isCorrect is false. intro is a short native-language phrase introducing the video, such as asking whether the given sentences are correct. outro asks viewers to write the answer in the comments.",
      "The sentence must be completely random and must not repeat any sentence used in previous generations, even when this request runs immediately after another one. The four sentences in the same video must all be different from each other.",
      "caption has 2 or 3 relevant hashtags.",
    ].join("\n"),
    { learningLanguage: LANGUAGE_NAMES[language], nativeLanguage: LANGUAGE_NAMES[nativeLanguage] },
    parseSentencePlan,
  );
}

async function createSentencePayload(language: LanguageCode, nativeLanguage: LanguageCode): Promise<OriginalMascotLearningVideoPayload | null> {
  const plans = await Promise.all([
    createSingleSentencePlan(language, nativeLanguage),
    createSingleSentencePlan(language, nativeLanguage),
    createSingleSentencePlan(language, nativeLanguage),
    createSingleSentencePlan(language, nativeLanguage),
  ]);
  if (plans.some((plan) => !plan)) return null;
  const [plan1, plan2, plan3, plan4] = plans as [NonNullable<typeof plans[number]>, NonNullable<typeof plans[number]>, NonNullable<typeof plans[number]>, NonNullable<typeof plans[number]>];
  const spokenPerPlan = (plan: typeof plan1) => [
    { text: plan.sentence, language },
    { text: plan.question, language: nativeLanguage },
    { text: plan.reveal, language: nativeLanguage },
    ...(plan.correction ? [{ text: `${plan.reveal}! ${plan.correction}`, language }] : []),
  ];
  const allSpoken = [...spokenPerPlan(plan1), ...spokenPerPlan(plan2), ...spokenPerPlan(plan3), ...spokenPerPlan(plan4)];
  const introSpoken = plan1.intro;
  const outroSpoken = plan4.outro;
  const [audioDataUrls, outroAudio, introAudio] = await Promise.all([
    generatePoyoSpeechDataUrls(allSpoken),
    generatePoyoSpeechDataUrls([{ text: outroSpoken, language: nativeLanguage }]),
    generatePoyoSpeechDataUrls([{ text: introSpoken, language: nativeLanguage }]),
  ]);
  let audioIndex = 0;
  const takeAudios = (plan: typeof plan1) => {
    const sentenceAudio = audioDataUrls[audioIndex++]!;
    const questionAudio = audioDataUrls[audioIndex++]!;
    const revealAudio = audioDataUrls[audioIndex++]!;
    const correctionAudio = plan.correction ? audioDataUrls[audioIndex++]! : null;
    return { sentenceAudio, questionAudio, revealAudio, correctionAudio };
  };
  const buildSentenceScenes = (plan: typeof plan1, audios: ReturnType<typeof takeAudios>, hasTimer: boolean, hasReveal: boolean) => {
    const base = { kind: "sentence" as const, sentence: plan.sentence, isCorrect: plan.isCorrect, correction: plan.correction || null };
    const scenes: OriginalMascotLearningVideoScene[] = [
      { ...base, phase: "question" as const, subtitle: plan.question, audioDataUrl: audios.sentenceAudio },
    ];
    if (hasTimer) {
      scenes.push({ ...base, phase: "countdown" as const, subtitle: "", durationSeconds: 5 });
    }
    if (hasReveal) {
      scenes.push({
        ...base,
        phase: "reveal" as const,
        subtitle: plan.reveal,
        audioDataUrl: plan.isCorrect || !audios.correctionAudio ? audios.revealAudio : audios.correctionAudio,
      });
    }
    return scenes;
  };
  const outroScene = { kind: "outro" as const, lines: [plan4.outro], subtitle: "", audioDataUrl: outroAudio[0]! };
  const introScene = { kind: "outro" as const, lines: [plan1.intro], subtitle: "", audioDataUrl: introAudio[0]! };
  return {
    mode: "sentence-check-video",
    caption: [plan1.caption, plan2.caption, plan3.caption, plan4.caption].join("\n\n"),
    scenes: [
      introScene,
      ...buildSentenceScenes(plan1, takeAudios(plan1), true, true),
      ...buildSentenceScenes(plan2, takeAudios(plan2), true, true),
      ...buildSentenceScenes(plan3, takeAudios(plan3), true, true),
      ...buildSentenceScenes(plan4, takeAudios(plan4), true, false),
      outroScene,
    ],
  };
}

async function createSentenceTranslationPayload(language: LanguageCode, nativeLanguage: LanguageCode): Promise<OriginalMascotLearningVideoPayload | null> {
  const plans: Array<NonNullable<Awaited<ReturnType<typeof createPlan<SentenceTranslationPlan>>>>> = [];
  let attempts = 0;
  while (plans.length < 5 && attempts < 20) {
    attempts++;
    const plan = await createPlan<SentenceTranslationPlan>(
      [
        "Create a random sentence translation snippet for a FoxiesDeck vertical learning video.",
        "Return one JSON object only: { caption, sentence, translation, commentPrompt }.",
        "sentence is a single, natural, useful sentence in the learning language. translation is its natural equivalent in the native language. Do not tie the sentence to any CEFR level; pick it completely at random.",
        "commentPrompt is a native-language phrase asking viewers to write the answer in the comments.",
        "caption is a concise native-language social caption with 2 or 3 relevant hashtags. Keep the sentence, translation, and commentPrompt brief and speakable.",
        "The sentence must be completely random and must not repeat any sentence used in previous generations, even when this request runs immediately after another one. All five sentences in the same video must be different from each other.",
      ].join("\n"),
      {
        learningLanguage: LANGUAGE_NAMES[language],
        nativeLanguage: LANGUAGE_NAMES[nativeLanguage],
      },
      parseSentenceTranslationPlan,
    );
    if (!plan) continue;
    plans.push(plan);
  }
  if (plans.length < 5) return null;

  const speakerMascot = pick(CHARACTER_VARIATIONS);
  const speakerVoice = pick(NON_ORIGINAL_VOICE_IDS);
  const spokenSegments = plans.flatMap((plan, index) => [
    { text: plan.sentence, language, speed: 1, voice: speakerVoice },
    index < 4 ? { text: plan.translation, language: nativeLanguage, speed: 1 } : { text: plan.commentPrompt, language: nativeLanguage, speed: 1 },
  ]);
  const audioDataUrls = await generatePoyoSpeechDataUrls(spokenSegments);
  let audioIndex = 0;
  const scenes: OriginalMascotLearningVideoScene[] = [];
  for (let index = 0; index < plans.length; index++) {
    const plan = plans[index]!;
    const isLast = index === plans.length - 1;
    scenes.push({
      kind: "sentence-translation" as const,
      phase: "sentence" as const,
      sentence: plan.sentence,
      translation: plan.translation,
      commentPrompt: plan.commentPrompt,
      speakerMascot,
      subtitle: "",
      audioDataUrl: audioDataUrls[audioIndex++]!,
    });
    scenes.push({
      kind: "sentence-translation" as const,
      phase: isLast ? "comment" as const : "translation" as const,
      sentence: plan.sentence,
      translation: plan.translation,
      commentPrompt: plan.commentPrompt,
      speakerMascot,
      subtitle: "",
      audioDataUrl: audioDataUrls[audioIndex++]!,
    });
  }
  return {
    mode: "sentence-translation-video",
    caption: plans.map((plan) => plan.caption).join("\n\n"),
    scenes,
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
        : mode === "sentence-check-video"
          ? await createSentencePayload(language, nativeLanguage)
          : await createSentenceTranslationPayload(language, nativeLanguage);
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
      errorCode: error instanceof SocialStudioVocabularyError ? error.code : error instanceof PoyoResponsesProviderError ? "poyo_responses_provider_error" : "learning_video_generation_failed",
      diagnostic: createSocialStudioDiagnostic({
        stage: "A1 to C1 script plan",
        provider: "PoYo Responses / Terra",
        error,
        fallbackDetail: "The script-planning request failed before voices could be created.",
      }),
    }, { status: 502 });
  }
}
