import { z } from "zod";
import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import { generatePoyoSpeechDataUrls, PoyoSpeechError } from "@/features/twitter-automation/poyo-speech";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { generateSocialStudioTextWithFallback, getSocialStudioResponsesErrorCode, getSocialStudioResponsesProviderLabel, SOCIAL_CONTENT_CREATIVE_MODEL } from "@/features/twitter-automation/social-studio-poyo";
import { createSocialStudioDiagnostic } from "@/features/twitter-automation/social-studio-diagnostics";
import { createNativeVisualCaption, getNativeCaptionHashtags } from "@/features/twitter-automation/social-video-titles";
import { resolveSocialStudioVocabularyCard, SocialStudioVocabularyError } from "@/features/twitter-automation/social-studio-vocabulary";
import type { LanguageCode, LocaleCode, Tier, VocabularyCard } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 720;

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

async function createPlan(language: LanguageCode, nativeLanguage: LanguageCode, tier: Tier) {
  const instructions = [
    "Create a FoxiesDeck vertical short-video plan with exactly three phases about commonly confused or very-close-in-meaning vocabulary words.",
    "Return one JSON object only, with exactly: phases, caption. phases must contain exactly three objects. Each phase object must contain exactly: firstTerm, secondTerm, connector, question, firstMeaningTail, secondMeaningTail.",
    "Every phase needs two real, distinct single words in the requested learning language. All six terms across the plan must be different. Choose them yourself, never from a catalogue. Do not use any previously used terms or example lists. The words must be completely random and must not repeat any term used in previous generations, even when this request runs immediately after another one. Never invent words, use translations, use inflections of the same word, or choose an unrelated pair.",
    "connector is only the native-language equivalent of 'and'. question is the native-language equivalent of 'what is the difference between them?'.",
    "firstMeaningTail is a native-language phrase that follows the first term and means '[its meaning] while,'; do not repeat the first term. secondMeaningTail is a native-language phrase that follows the second term and means '[its meaning].'; do not repeat the second term.",
    `caption is one ready-to-post native-language caption under 260 characters, with an inviting hook. End with exactly these native-language hashtags: ${getNativeCaptionHashtags(nativeLanguage).join(" ")}. Do not use English hashtags unless English is the selected native language.`,
    "Use natural punctuation for speech. Keep every spoken fragment brief and easy to understand.",
  ].join("\n");
  const input = {
    learningLanguage: LANGUAGE_NAMES[language],
    nativeLanguage: LANGUAGE_NAMES[nativeLanguage],
    requestedTier: tier,
  };
  const generate = async (repair: boolean) => {
    const { output } = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_CREATIVE_MODEL,
      (client, model) => client.responses.create({
      model,
      instructions: repair ? `${instructions}\nYour previous response was invalid. Return valid JSON with all exact fields and three phases.` : instructions,
      input: JSON.stringify(input),
      max_output_tokens: 1_200,
      reasoning: { effort: "none" },
      store: false,
      text: { format: { type: "text" }, verbosity: "low" },
      }),
      extractResponseOutputText,
    );
    return parsePlan(output);
  };
  return await generate(false) ?? await generate(true);
}

async function resolveCards(plan: ConfusedWordsPlan, language: LanguageCode, nativeLanguage: LocaleCode) {
  const resolved = new Map<string, VocabularyCard>();
  for (const term of plan.phases.flatMap((phase) => [phase.firstTerm, phase.secondTerm])) {
    const key = normalizeTerm(term);
    resolved.set(key, await resolveSocialStudioVocabularyCard(term, language, nativeLanguage));
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
    plan = await createPlan(parsed.data.language, parsed.data.nativeLanguage, parsed.data.tier);
  } catch (error) {
    return Response.json({
      errorCode: error instanceof SocialStudioVocabularyError ? error.code : getSocialStudioResponsesErrorCode(error) ?? "confused_words_plan_failed",
      diagnostic: createSocialStudioDiagnostic({ stage: "Confused Words script plan", provider: getSocialStudioResponsesProviderLabel(error, "PoYo Responses / Terra"), error, fallbackDetail: "The three-phase script request failed." }),
    }, { status: 502 });
  }
  if (!plan) return Response.json({
    errorCode: "invalid_confused_words_plan",
    diagnostic: createSocialStudioDiagnostic({ stage: "Confused Words plan validation", provider: "PoYo Responses / Terra", fallbackDetail: "The provider response did not meet the required three-phase format." }),
  }, { status: 502 });

  let cards: Array<{ first: VocabularyCard; second: VocabularyCard }>;
  try {
    cards = await resolveCards(plan, parsed.data.language, parsed.data.nativeLanguage);
  } catch (error) {
    return Response.json({
      errorCode: error instanceof SocialStudioVocabularyError ? error.code : getSocialStudioResponsesErrorCode(error) ?? "custom_card_generation_failed",
      diagnostic: createSocialStudioDiagnostic({ stage: "Custom vocabulary card generation", provider: getSocialStudioResponsesProviderLabel(error, "PoYo Responses / Terra"), error, fallbackDetail: "A required card was not present in the catalogue and its custom-card request failed." }),
    }, { status: 502 });
  }

  const sceneDefinitions = plan.phases.flatMap((phase, phaseIndex) => [
    { phaseIndex, text: phase.firstTerm, language: parsed.data.language, mascot: 18 as const, mirrored: true, speechSpeed: 1, playbackRate: 1 },
    { phaseIndex, text: phase.connector, language: parsed.data.nativeLanguage, mascot: 18 as const, mirrored: true, speechSpeed: 1, playbackRate: 1 },
    { phaseIndex, text: phase.secondTerm, language: parsed.data.language, mascot: 18 as const, mirrored: false, speechSpeed: 1, playbackRate: 1 },
    { phaseIndex, text: phase.question, language: parsed.data.nativeLanguage, mascot: 3 as const, mirrored: false, speechSpeed: 1, playbackRate: 1 },
    { phaseIndex, text: phase.firstTerm, language: parsed.data.language, mascot: 4 as const, mirrored: true, speechSpeed: 1, playbackRate: 1 },
    { phaseIndex, text: phase.firstMeaningTail, language: parsed.data.nativeLanguage, mascot: 4 as const, mirrored: true, speechSpeed: 1, playbackRate: 1 },
    { phaseIndex, text: phase.secondTerm, language: parsed.data.language, mascot: 4 as const, mirrored: false, speechSpeed: 1, playbackRate: 1 },
    { phaseIndex, text: phase.secondMeaningTail, language: parsed.data.nativeLanguage, mascot: 4 as const, mirrored: false, speechSpeed: 1, playbackRate: 1 },
  ]);

  try {
    const audioDataUrls = await generateSceneSpeechInBatches(sceneDefinitions);
    return Response.json({
      caption: createNativeVisualCaption({
        kind: "falseFriends",
        learningLanguage: parsed.data.language,
        nativeLanguage: parsed.data.nativeLanguage,
        itemCount: PHASE_COUNT,
      }),
      phases: cards,
      scenes: sceneDefinitions.map((scene, index) => ({
        phaseIndex: scene.phaseIndex,
        text: scene.text,
        language: scene.language,
        mascot: scene.mascot,
        mirrored: scene.mirrored,
        playbackRate: scene.playbackRate,
        audioDataUrl: audioDataUrls[index]!,
      })),
    });
  } catch (error) {
    if (error instanceof PoyoSpeechError) return Response.json({
      errorCode: error.code,
      diagnostic: createSocialStudioDiagnostic({ stage: "Confused Words voice generation", provider: "PoYo Generate / ElevenLabs", error, fallbackDetail: "One of the voice batches could not be completed." }),
    }, { status: error.code === "poyo_not_configured" ? 503 : 502 });
    return Response.json({
      errorCode: "speech_generation_failed",
      diagnostic: createSocialStudioDiagnostic({ stage: "Confused Words voice generation", provider: "PoYo Generate / ElevenLabs", error, fallbackDetail: "The voice generation step failed unexpectedly." }),
    }, { status: 502 });
  }
}
