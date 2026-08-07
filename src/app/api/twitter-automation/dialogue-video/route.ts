import { z } from "zod";
import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import { getDialogueBackgroundPublicUrl, pickDialogueBackgroundPath } from "@/features/twitter-automation/dialogue-backgrounds";
import { FOXIESDECK_MASCOT_VOICE, generatePoyoSpeechDataUrls, PoyoSpeechError } from "@/features/twitter-automation/poyo-speech";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSocialStudioPoyoClient, generateSocialStudioTextWithFallback, PoyoResponsesProviderError, SOCIAL_CONTENT_CREATIVE_MODEL } from "@/features/twitter-automation/social-studio-poyo";
import { createSocialStudioDiagnostic } from "@/features/twitter-automation/social-studio-diagnostics";
import type { LanguageCode } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LANGUAGE_CODES = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"] as const;
const CHARACTER_VARIATIONS = ["Animal.png", "Bear.png", "Bunny.png", "Lion.png", "Panda.png", "Racoon.png", "Tiger.png", "Wolf.png"] as const;
const DIALOGUE_VOICE_IDS = [
  "J1lfByWs8gvoooryDWEi",
  "1jR8l3dNgd4OQs6kxgaF",
  "XJ2fW4ybq7HouelYYGcL",
  "IvUJKFyjVb5hItY9dJAT",
  "M5t0724ORuAGCh3p3DUR",
  "nuVIy6kn92EbEZwTlTnc",
  "fBD19tfE58bkETeiwUoC",
  "eppqEXVumQ3CfdndcIBd",
] as const;

function cyrb128(str: string) {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: readonly T[], seed: string) {
  const rng = mulberry32(cyrb128(seed));
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Assign each non-Original mascot a random voice from the pool once, then keep
// that cast stable forever. The seed is fixed so every deploy uses the same
// mapping, but the mapping itself is a random shuffle of the provided IDs.
const SHUFFLED_DIALOGUE_VOICE_IDS = shuffleWithSeed(DIALOGUE_VOICE_IDS, "foxiesdeck-dialogue-voice-cast-v1");

const DIALOGUE_MASCOT_VOICES = Object.fromEntries([
  ...CHARACTER_VARIATIONS.map((variation, index) => {
    const id = SHUFFLED_DIALOGUE_VOICE_IDS[index]!;
    return [variation, { id, label: `Voice ${index + 1}` }] as const;
  }),
  ["Original.png", { id: FOXIESDECK_MASCOT_VOICE, label: "Foxy — custom mascot voice" }] as const,
]) as Record<string, { id: string; label: string }>;

const requestSchema = z.object({
  mode: z.enum(["marketing-dialogue-video", "learning-dialogue-video"]),
  language: z.enum(LANGUAGE_CODES),
  nativeLanguage: z.enum(LANGUAGE_CODES),
});

type DialogueMode = z.infer<typeof requestSchema>["mode"];
type DialogueSpeaker = "learner" | "guide";
type DialoguePlanScene = { text: string; translation?: string; speaker?: DialogueSpeaker };
type DialoguePlan = { caption: string; scenes: DialoguePlanScene[] };

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  tr: "Turkish", en: "English", de: "German", ru: "Russian", fr: "French", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ar: "Arabic", ja: "Japanese", ko: "Korean", "zh-CN": "Chinese",
};

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)]!;
}

function extractJsonObject(value: string) {
  const trimmed = value.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : trimmed;
}

function parsePlan(value: string, needsTranslation: boolean, maxSceneCount: number, requiresMarketingRoles: boolean): DialoguePlan | null {
  try {
    const parsed = JSON.parse(extractJsonObject(value)) as { caption?: unknown; scenes?: unknown };
    if (typeof parsed.caption !== "string" || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0 || parsed.scenes.length > maxSceneCount) return null;
    const scenes = parsed.scenes.map((scene) => {
      if (!scene || typeof scene !== "object") return null;
      const values = scene as { text?: unknown; translation?: unknown; speaker?: unknown };
      const text = typeof values.text === "string" ? values.text.trim() : "";
      const translation = typeof values.translation === "string" ? values.translation.trim() : "";
      if (!text || text.length > 260 || (needsTranslation && (!translation || translation.length > 300))) return null;
      if (requiresMarketingRoles && values.speaker !== "learner" && values.speaker !== "guide") return null;
      if (needsTranslation) return { text, translation };
      return requiresMarketingRoles ? { text, speaker: values.speaker as DialogueSpeaker } : { text };
    });
    if (scenes.some((scene) => !scene)) return null;
    const resolvedScenes = scenes as DialoguePlanScene[];
    if (requiresMarketingRoles && (resolvedScenes[0]?.speaker !== "learner" || !resolvedScenes.some((scene) => scene.speaker === "guide"))) return null;
    return { caption: parsed.caption.trim().slice(0, 400), scenes: resolvedScenes };
  } catch {
    return null;
  }
}

function instructionsFor(mode: DialogueMode) {
  if (mode === "marketing-dialogue-video") {
    return [
      "Create a brief FoxiesDeck marketing conversation for a vertical social video.",
      "Return one JSON object only: { caption, scenes }. scenes may contain up to 9 objects with exactly { text, speaker }. speaker is exactly learner or guide. A final Download FoxiesDeck NOW! CTA is appended by the app, so do not include it yourself.",
      "There are two fixed identities. learner is a random mascot who is completely clueless about FoxiesDeck. The learner opens frustrated that they cannot learn the provided learning language, then can only describe their problem or ask curious follow-up questions. The learner must never explain, endorse, recommend, or state any FoxiesDeck feature or fact.",
      "guide is always the Original mascot. The guide is the only character who knows FoxiesDeck. Every product fact, feature explanation, recommendation, benefit, and call to action must be spoken by guide. The guide never acts confused or asks how the app works.",
      "Only mention real FoxiesDeck capabilities when useful: choose from 14 learning languages and CEFR tiers; draw, search, or create vocabulary cards; build a personal card pool; learn with quizzes; cards become learned after their tier threshold; earn points and rank up; review learned cards; practice conversations with AI characters; ask Foxy about words, grammar, and usage; play vocabulary games. The mobile app supports the core card collection, draw, quiz, review, and rank journey.",
      "Keep each text under 18 words, conversational, speakable, and free of stage directions. caption is a concise native-language post caption with 2 or 3 relevant hashtags.",
    ].join("\n");
  }
  return [
    "Create a lively, everyday two-person conversation for a language-learning vertical social video.",
    "Return one JSON object only: { caption, scenes }. scenes may contain up to 14 objects with exactly { text, translation }.",
    "text is spoken entirely in the provided learning language. translation is its natural native-language subtitle.",
    "Pick a completely random real-life situation every time. Examples include: gossip about someone, discussing a movie or show, chatting at a café, ordering at a restaurant, shopping at a store, asking a stranger on the street, texting or calling online, talking to a partner, or a casual family conversation.",
    "The two speakers should feel like natural friends, coworkers, classmates, couple, family members, or strangers. Vary the relationship, location, and topic freely.",
    "Keep each text and translation under 22 words, conversational, and speakable. caption is a concise native-language post caption with 2 or 3 relevant hashtags.",
  ].join("\n");
}

async function createPlan(mode: DialogueMode, language: LanguageCode, nativeLanguage: LanguageCode) {
  const poyo = createSocialStudioPoyoClient();
  const input = mode === "marketing-dialogue-video"
    ? { nativeLanguage: LANGUAGE_NAMES[nativeLanguage], learningLanguage: LANGUAGE_NAMES[language] }
    : { learningLanguage: LANGUAGE_NAMES[language], nativeLanguage: LANGUAGE_NAMES[nativeLanguage] };
  const generate = async (repair: boolean) => {
    const { output } = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_CREATIVE_MODEL,
      (model) => poyo.responses.create({
      model,
      instructions: `${instructionsFor(mode)}${repair ? "\nThe previous response was invalid. Return valid JSON with every required field." : ""}`,
      input: JSON.stringify(input),
      max_output_tokens: 900,
      reasoning: { effort: "none" },
      store: false,
      text: { format: { type: "text" }, verbosity: "low" },
      }),
      extractResponseOutputText,
    );
    return parsePlan(
      output,
      mode === "learning-dialogue-video",
      mode === "marketing-dialogue-video" ? 9 : 14,
      mode === "marketing-dialogue-video",
    );
  };
  return await generate(false) ?? await generate(true);
}

export async function POST(request: Request) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) return Response.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  if (!process.env.POYO_API_KEY?.trim()) return Response.json({ errorCode: "poyo_not_configured" }, { status: 503 });

  const { mode, nativeLanguage } = parsed.data;
  const spokenLanguage = mode === "marketing-dialogue-video" ? pick(LANGUAGE_CODES) : parsed.data.language;
  let plan: DialoguePlan | null;
  try {
    plan = await createPlan(mode, spokenLanguage, nativeLanguage);
  } catch (error) {
    return Response.json({
      errorCode: error instanceof PoyoResponsesProviderError ? "poyo_responses_provider_error" : "dialogue_plan_failed",
      diagnostic: createSocialStudioDiagnostic({ stage: "Dialogue script plan", provider: "PoYo Responses / Terra", error, fallbackDetail: "The dialogue script request failed." }),
    }, { status: 502 });
  }
  if (!plan) return Response.json({
    errorCode: "invalid_dialogue_plan",
    diagnostic: createSocialStudioDiagnostic({ stage: "Dialogue plan validation", provider: "PoYo Responses / Terra", fallbackDetail: "The returned dialogue did not meet the required scene and language format." }),
  }, { status: 502 });

  try {
    const scenes = mode === "marketing-dialogue-video"
      ? [...plan.scenes, { text: "Download FoxiesDeck NOW!", speaker: "guide" as const }]
      : plan.scenes;
    const firstCharacter = pick(CHARACTER_VARIATIONS);
    const secondCharacter = mode === "marketing-dialogue-video"
      ? "Original.png"
      : pick(CHARACTER_VARIATIONS.filter((variation) => variation !== firstCharacter && DIALOGUE_MASCOT_VOICES[variation].id !== DIALOGUE_MASCOT_VOICES[firstCharacter].id));
    const backgroundVideoPath = pickDialogueBackgroundPath();
    const renderedScenes = scenes.map((scene, index) => ({
      ...scene,
      character: mode === "marketing-dialogue-video" ? scene.speaker === "guide" ? 2 : 1 : index % 2 === 0 ? 1 : 2,
    })) as Array<DialoguePlanScene & { character: 1 | 2 }>;
    const audioDataUrls = await generatePoyoSpeechDataUrls(renderedScenes.map((scene) => ({
      text: scene.text,
      language: mode === "marketing-dialogue-video" ? nativeLanguage : spokenLanguage,
      speed: 1,
      voice: (scene.character === 1 ? DIALOGUE_MASCOT_VOICES[firstCharacter] : DIALOGUE_MASCOT_VOICES[secondCharacter]).id,
    })));
    return Response.json({
      caption: plan.caption,
      firstCharacter,
      secondCharacter,
      backgroundVideoUrl: getDialogueBackgroundPublicUrl(),
      backgroundVideoPath,
      voices: {
        [firstCharacter]: DIALOGUE_MASCOT_VOICES[firstCharacter].label,
        [secondCharacter]: DIALOGUE_MASCOT_VOICES[secondCharacter].label,
      },
      scenes: renderedScenes.map((scene, index) => ({
        ...scene,
        audioDataUrl: audioDataUrls[index]!,
      })),
    });
  } catch (error) {
    if (error instanceof PoyoSpeechError) return Response.json({
      errorCode: error.code,
      diagnostic: createSocialStudioDiagnostic({ stage: "Dialogue voice generation", provider: "PoYo Generate / ElevenLabs", error, fallbackDetail: "The voice task could not be completed." }),
    }, { status: error.code === "poyo_not_configured" ? 503 : 502 });
    return Response.json({
      errorCode: "speech_generation_failed",
      diagnostic: createSocialStudioDiagnostic({ stage: "Dialogue voice generation", provider: "PoYo Generate / ElevenLabs", error, fallbackDetail: "The voice task failed unexpectedly." }),
    }, { status: 502 });
  }
}
