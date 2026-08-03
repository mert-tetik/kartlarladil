import { z } from "zod";
import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import { generatePoyoSpeechDataUrls, PoyoSpeechError } from "@/features/twitter-automation/poyo-speech";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSocialStudioPoyoClient, SOCIAL_CONTENT_CREATIVE_MODEL } from "@/features/twitter-automation/social-studio-poyo";
import type { LanguageCode, Tier } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const requestSchema = z.object({
  language: z.enum(["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"]),
  nativeLanguage: z.enum(["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"]),
  tier: z.enum(["A1", "A2", "B1", "B2", "C1"]),
});

type ConfusedWordsPlan = {
  firstTerm: string;
  secondTerm: string;
  firstMeaningTail: string;
  secondMeaningTail: string;
  connector: string;
  question: string;
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

function parsePlan(value: string): ConfusedWordsPlan | null {
  try {
    const plan = JSON.parse(extractJsonObject(value)) as Partial<ConfusedWordsPlan>;
    const fields = Object.fromEntries(Object.entries(plan).map(([key, field]) => [key, typeof field === "string" ? field.trim() : ""])) as Record<keyof ConfusedWordsPlan, string>;
    if (fields.firstTerm.length < 2 || fields.secondTerm.length < 2 || fields.firstTerm.toLocaleLowerCase() === fields.secondTerm.toLocaleLowerCase()) return null;
    if (fields.connector.length < 1 || fields.question.length < 4 || fields.firstMeaningTail.length < 4 || fields.secondMeaningTail.length < 4 || fields.caption.length < 12) return null;
    return {
      firstTerm: fields.firstTerm.slice(0, 80),
      secondTerm: fields.secondTerm.slice(0, 80),
      connector: fields.connector.slice(0, 40),
      question: fields.question.slice(0, 120),
      firstMeaningTail: fields.firstMeaningTail.slice(0, 180),
      secondMeaningTail: fields.secondMeaningTail.slice(0, 180),
      caption: fields.caption.slice(0, 400),
    };
  } catch {
    return null;
  }
}

async function createPlan(language: LanguageCode, nativeLanguage: LanguageCode, tier: Tier) {
  const instructions = [
    "Create a FoxiesDeck vertical short-video plan about two easily confused or very-close-in-meaning vocabulary words.",
    "Return one JSON object only, with exactly: firstTerm, secondTerm, connector, question, firstMeaningTail, secondMeaningTail, caption.",
    "firstTerm and secondTerm must be two real, distinct words in the selected learning language. Pick a genuinely useful pair learners commonly mix up because their meanings are close, then make their difference precise. Do not use translations, inflections of the same word, invented words, or an unrelated pair.",
    "connector is only the native-language equivalent of 'and'. question is the native-language equivalent of 'what is the difference between them?'.",
    "firstMeaningTail is a native-language phrase that follows the first term and means '[its meaning] while,'; do not repeat the first term. secondMeaningTail is a native-language phrase that follows the second term and means '[its meaning].'; do not repeat the second term.",
    "caption is a ready-to-post native-language caption under 260 characters, with an inviting hook and 2 or 3 relevant hashtags including #languagelearning.",
    "Use natural punctuation for speech. Keep every spoken fragment brief and easy to understand.",
  ].join("\n");
  const input = { learningLanguage: LANGUAGE_NAMES[language], nativeLanguage: LANGUAGE_NAMES[nativeLanguage], tier };
  const poyo = createSocialStudioPoyoClient();
  const generate = async (repair: boolean) => {
    const response = await poyo.responses.create({
      model: SOCIAL_CONTENT_CREATIVE_MODEL,
      instructions: repair ? `${instructions}\nYour previous response was invalid. Return valid JSON with all exact fields.` : instructions,
      input: JSON.stringify(input),
      max_output_tokens: 500,
      reasoning: { effort: "none" },
      store: false,
      text: { format: { type: "text" }, verbosity: "low" },
    });
    return parsePlan(extractResponseOutputText(response));
  };
  return await generate(false) ?? await generate(true);
}

export async function POST(request: Request) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) return Response.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  if (!process.env.POYO_API_KEY?.trim()) return Response.json({ errorCode: "poyo_not_configured" }, { status: 503 });

  let plan: ConfusedWordsPlan | null;
  try {
    plan = await createPlan(parsed.data.language, parsed.data.nativeLanguage, parsed.data.tier);
  } catch {
    return Response.json({ errorCode: "confused_words_plan_failed" }, { status: 502 });
  }
  if (!plan) return Response.json({ errorCode: "invalid_confused_words_plan" }, { status: 502 });

  const sceneDefinitions = [
    { text: plan.firstTerm, language: parsed.data.language, mascot: 18, mirrored: true },
    { text: plan.connector, language: parsed.data.nativeLanguage, mascot: 18, mirrored: true },
    { text: plan.secondTerm, language: parsed.data.language, mascot: 18, mirrored: false },
    { text: plan.question, language: parsed.data.nativeLanguage, mascot: 3, mirrored: false },
    { text: plan.firstTerm, language: parsed.data.language, mascot: 4, mirrored: true },
    { text: plan.firstMeaningTail, language: parsed.data.nativeLanguage, mascot: 4, mirrored: true },
    { text: plan.secondTerm, language: parsed.data.language, mascot: 4, mirrored: false },
    { text: plan.secondMeaningTail, language: parsed.data.nativeLanguage, mascot: 4, mirrored: false },
  ] as const;

  try {
    // PoYo's ElevenLabs Turbo endpoint accepts speeds up to 1.2. The renderer
    // applies the final small playback adjustment so this video still plays at 1.25×.
    const audioDataUrls = await generatePoyoSpeechDataUrls(sceneDefinitions.map(({ text, language }) => ({ text, language, speed: 1.2 })));
    return Response.json({
      caption: plan.caption,
      cards: { firstTerm: plan.firstTerm, secondTerm: plan.secondTerm, tier: parsed.data.tier },
      scenes: sceneDefinitions.map((scene, index) => ({ ...scene, audioDataUrl: audioDataUrls[index]! })),
    });
  } catch (error) {
    if (error instanceof PoyoSpeechError) return Response.json({ errorCode: error.code }, { status: error.code === "poyo_not_configured" ? 503 : 502 });
    return Response.json({ errorCode: "speech_generation_failed" }, { status: 502 });
  }
}
