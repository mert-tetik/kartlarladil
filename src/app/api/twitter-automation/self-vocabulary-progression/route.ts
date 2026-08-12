import { z } from "zod";
import { isLanguageCode } from "@/data/languages";
import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSocialStudioDiagnostic } from "@/features/twitter-automation/social-studio-diagnostics";
import {
  isSelfVocabularyProgressionContent,
  normalizeSelfVocabularyProgressionTerm,
  type SelfVocabularyProgressionContent,
} from "@/features/twitter-automation/self-vocabulary-progression";
import {
  createSocialStudioPoyoClient,
  generateSocialStudioTextWithFallback,
  PoyoResponsesProviderError,
  SOCIAL_CONTENT_CREATIVE_MODEL,
} from "@/features/twitter-automation/social-studio-poyo";
import type { LanguageCode } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  language: z.string().refine(isLanguageCode),
  nativeLanguage: z.string().refine(isLanguageCode),
  recentTerms: z.array(z.string().trim().min(1).max(80)).max(36).default([]),
});

const ENGLISH_LANGUAGE_NAMES: Record<LanguageCode, string> = {
  tr: "Turkish", en: "English", de: "German", ru: "Russian", fr: "French", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ar: "Arabic", ja: "Japanese", ko: "Korean", "zh-CN": "Chinese",
};

const generatedProgressionSchema = z.object({
  beginnerTerm: z.string().trim().min(1).max(80),
  intermediateTerm: z.string().trim().min(1).max(80),
  advancedTerm: z.string().trim().min(1).max(80),
  beginnerTier: z.literal("A1"),
  intermediateTier: z.literal("B2"),
  advancedTier: z.literal("C1"),
  beginnerExplanation: z.string().trim().min(12).max(130),
  intermediateExplanation: z.string().trim().min(12).max(130),
  advancedExplanation: z.string().trim().min(12).max(130),
}).strict();

function extractJsonObject(value: string) {
  const withoutFence = value.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace ? withoutFence.slice(firstBrace, lastBrace + 1) : withoutFence;
}

function isSingleLine(value: string) {
  return !/[\r\n]/u.test(value);
}

function parseGeneratedProgression(value: string, recentTerms: Set<string>): SelfVocabularyProgressionContent | null {
  try {
    const parsed = generatedProgressionSchema.safeParse(JSON.parse(extractJsonObject(value)));
    if (!parsed.success || !isSelfVocabularyProgressionContent(parsed.data)) return null;

    const terms = [parsed.data.beginnerTerm, parsed.data.intermediateTerm, parsed.data.advancedTerm]
      .map(normalizeSelfVocabularyProgressionTerm);
    const explanations = [parsed.data.beginnerExplanation, parsed.data.intermediateExplanation, parsed.data.advancedExplanation];
    if (
      terms.some((term) => recentTerms.has(term))
      || new Set(terms).size !== terms.length
      || new Set(explanations).size !== explanations.length
      || explanations.some((explanation) => !isSingleLine(explanation))
    ) {
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

async function createSelfVocabularyProgressionContent({
  language,
  nativeLanguage,
  recentTerms,
}: {
  language: LanguageCode;
  nativeLanguage: LanguageCode;
  recentTerms: string[];
}) {
  const poyo = createSocialStudioPoyoClient();
  const recentTermSet = new Set(recentTerms.map(normalizeSelfVocabularyProgressionTerm));
  const instructions = [
    "Create content for FoxiesDeck's Beginner to Advanced (Self) social image.",
    "Return only one JSON object with exactly these nine fields: beginnerTerm, intermediateTerm, advancedTerm, beginnerTier, intermediateTier, advancedTier, beginnerExplanation, intermediateExplanation, advancedExplanation.",
    `Choose three real, useful, distinct ${ENGLISH_LANGUAGE_NAMES[language]} terms completely at random. They must express the same core meaning area as a genuine progression: the A1 term is the beginner-friendly choice, the B2 term is a more precise or sophisticated alternative, and the C1 term is the most advanced alternative. They must not merely be unrelated words from different levels.`,
    "Set beginnerTier to exactly A1, intermediateTier to exactly B2, and advancedTier to exactly C1. Every term must accurately match its assigned CEFR tier.",
    "Do not choose translations, antonyms, spelling variants, words that only look alike, or interchangeable duplicates. Never use a native-language word as a term.",
    `Write each explanation as one short, natural sentence in ${ENGLISH_LANGUAGE_NAMES[nativeLanguage]}. It must state the term's meaning and distinguish its level of precision, strength, register, or typical context from the lower-level alternative. Keep each under 130 characters. Do not add headings, markdown, quotes, CEFR labels, or emoji.`,
    recentTerms.length > 0
      ? `Do not use any of these terms because they appeared in recent generations: ${recentTerms.join(", ")}.`
      : "This is the first generation, so choose a fresh progression without relying on a fixed starter list.",
    "The three terms and explanations must be accurate, concise, social-media readable, and fully self-contained.",
  ].join("\n");

  const generate = async (repair: boolean) => {
    const { output } = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_CREATIVE_MODEL,
      (model) => poyo.responses.create({
        model,
        instructions: repair
          ? `${instructions}\nYour previous answer was invalid or repeated a recent term. Choose a completely different valid progression and return only the required JSON object.`
          : instructions,
        input: JSON.stringify({
          generator: "self-vocabulary-progression",
          learningLanguage: ENGLISH_LANGUAGE_NAMES[language],
          nativeLanguage: ENGLISH_LANGUAGE_NAMES[nativeLanguage],
          recentTerms,
        }),
        max_output_tokens: 620,
        reasoning: { effort: "minimal" },
        store: false,
        text: { format: { type: "text" }, verbosity: "low" },
      }),
      extractResponseOutputText,
    );
    return parseGeneratedProgression(output.trim(), recentTermSet);
  };

  return await generate(false) ?? await generate(true);
}

export async function POST(request: Request) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) {
    return Response.json({ errorCode: "unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  if (!process.env.POYO_API_KEY?.trim()) {
    return Response.json({ errorCode: "poyo_not_configured" }, { status: 503 });
  }

  try {
    const progression = await createSelfVocabularyProgressionContent(parsed.data);
    if (!progression) {
      return Response.json({
        errorCode: "invalid_vocabulary_progression",
        diagnostic: createSocialStudioDiagnostic({
          stage: "Self vocabulary-progression generation",
          provider: "PoYo Responses / Terra",
          fallbackDetail: "The generated progression was invalid or repeated a recent term.",
        }),
      }, { status: 502 });
    }

    return Response.json({ progression }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      errorCode: error instanceof PoyoResponsesProviderError ? "poyo_responses_provider_error" : "self_vocabulary_progression_generation_failed",
      diagnostic: createSocialStudioDiagnostic({
        stage: "Self vocabulary-progression generation",
        provider: "PoYo Responses / Terra",
        error,
        fallbackDetail: "The AI could not create a fresh vocabulary progression.",
      }),
    }, { status: 502 });
  }
}
