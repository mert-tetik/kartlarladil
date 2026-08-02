import { z } from "zod";
import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import { generatePoyoSpeechDataUrls, PoyoSpeechError } from "@/features/twitter-automation/poyo-speech";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSocialStudioPoyoClient, SOCIAL_CONTENT_CREATIVE_MODEL } from "@/features/twitter-automation/social-studio-poyo";
import type { LanguageCode } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LANGUAGE_CODES = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"] as const;
const CHARACTER_VARIATIONS = ["Animal.png", "Bear.png", "Bunny.png", "Lion.png", "Panda.png", "Racoon.png", "Tiger.png", "Wolf.png"] as const;

const requestSchema = z.object({
  mode: z.enum(["marketing-dialogue-video", "learning-dialogue-video"]),
  language: z.enum(LANGUAGE_CODES),
  nativeLanguage: z.enum(LANGUAGE_CODES),
});

type DialogueMode = z.infer<typeof requestSchema>["mode"];
type DialoguePlanScene = { text: string; translation?: string };
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

function parsePlan(value: string, needsTranslation: boolean): DialoguePlan | null {
  try {
    const parsed = JSON.parse(extractJsonObject(value)) as { caption?: unknown; scenes?: unknown };
    if (typeof parsed.caption !== "string" || !Array.isArray(parsed.scenes) || parsed.scenes.length < 4 || parsed.scenes.length > 6) return null;
    const scenes = parsed.scenes.map((scene) => {
      if (!scene || typeof scene !== "object") return null;
      const values = scene as { text?: unknown; translation?: unknown };
      const text = typeof values.text === "string" ? values.text.trim() : "";
      const translation = typeof values.translation === "string" ? values.translation.trim() : "";
      if (!text || text.length > 220 || (needsTranslation && (!translation || translation.length > 240))) return null;
      return needsTranslation ? { text, translation } : { text };
    });
    if (scenes.some((scene) => !scene)) return null;
    return { caption: parsed.caption.trim().slice(0, 400), scenes: scenes as DialoguePlanScene[] };
  } catch {
    return null;
  }
}

function instructionsFor(mode: DialogueMode) {
  if (mode === "marketing-dialogue-video") {
    return [
      "Create a brief FoxiesDeck marketing conversation for a vertical social video.",
      "Return one JSON object only: { caption, scenes }. scenes must contain 4 to 6 objects with exactly { text }.",
      "Both characters speak naturally in the provided native language. The first character is frustrated that they cannot learn the provided learning language; the other warmly suggests FoxiesDeck. Continue with a natural, low-pressure benefit and an encouraging close.",
      "Keep each text under 18 words, conversational, speakable, and free of stage directions. caption is a concise native-language post caption with 2 or 3 relevant hashtags.",
    ].join("\n");
  }
  return [
    "Create a brief, everyday two-person conversation for a language-learning vertical social video.",
    "Return one JSON object only: { caption, scenes }. scenes must contain 4 to 6 objects with exactly { text, translation }.",
    "text is spoken entirely in the provided learning language. translation is its natural native-language subtitle. The conversation must feel like a plausible everyday interaction, be suitable for learners, and use short, clear turns.",
    "Keep each text and translation under 18 words. caption is a concise native-language post caption with 2 or 3 relevant hashtags.",
  ].join("\n");
}

async function createPlan(mode: DialogueMode, language: LanguageCode, nativeLanguage: LanguageCode) {
  const poyo = createSocialStudioPoyoClient();
  const input = mode === "marketing-dialogue-video"
    ? { nativeLanguage: LANGUAGE_NAMES[nativeLanguage], learningLanguage: LANGUAGE_NAMES[language] }
    : { learningLanguage: LANGUAGE_NAMES[language], nativeLanguage: LANGUAGE_NAMES[nativeLanguage] };
  const generate = async (repair: boolean) => {
    const response = await poyo.responses.create({
      model: SOCIAL_CONTENT_CREATIVE_MODEL,
      instructions: `${instructionsFor(mode)}${repair ? "\nThe previous response was invalid. Return valid JSON with every required field." : ""}`,
      input: JSON.stringify(input),
      max_output_tokens: 700,
      reasoning: { effort: "none" },
      store: false,
      text: { format: { type: "text" }, verbosity: "low" },
    });
    return parsePlan(extractResponseOutputText(response), mode === "learning-dialogue-video");
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
  } catch {
    return Response.json({ errorCode: "dialogue_plan_failed" }, { status: 502 });
  }
  if (!plan) return Response.json({ errorCode: "invalid_dialogue_plan" }, { status: 502 });

  try {
    const audioDataUrls = await generatePoyoSpeechDataUrls(plan.scenes.map((scene) => ({
      text: scene.text,
      language: mode === "marketing-dialogue-video" ? nativeLanguage : spokenLanguage,
      speed: 1,
    })));
    const firstCharacter = pick(CHARACTER_VARIATIONS);
    const secondCharacter = pick(CHARACTER_VARIATIONS.filter((variation) => variation !== firstCharacter));
    return Response.json({
      caption: plan.caption,
      firstCharacter,
      secondCharacter,
      scenes: plan.scenes.map((scene, index) => ({
        ...scene,
        character: index % 2 === 0 ? 1 : 2,
        audioDataUrl: audioDataUrls[index]!,
      })),
    });
  } catch (error) {
    if (error instanceof PoyoSpeechError) return Response.json({ errorCode: error.code }, { status: error.code === "poyo_not_configured" ? 503 : 502 });
    return Response.json({ errorCode: "speech_generation_failed" }, { status: 502 });
  }
}
