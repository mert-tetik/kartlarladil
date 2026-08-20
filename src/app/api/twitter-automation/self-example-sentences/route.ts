import { z } from "zod";
import { isLanguageCode } from "@/data/languages";
import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import {
  isSelfExampleSentencesContent,
  normalizeSelfExampleSentence,
  type SelfExampleSentencesContent,
} from "@/features/twitter-automation/self-example-sentences";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSocialStudioDiagnostic } from "@/features/twitter-automation/social-studio-diagnostics";
import {
  generateSocialStudioTextWithFallback,
  getSocialStudioResponsesErrorCode,
  getSocialStudioResponsesProviderLabel,
  SOCIAL_CONTENT_CREATIVE_MODEL,
} from "@/features/twitter-automation/social-studio-poyo";
import type { LanguageCode } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

const requestSchema = z.object({
  language: z.string().refine(isLanguageCode),
  nativeLanguage: z.string().refine(isLanguageCode),
  recentSentences: z.array(z.string().trim().min(1).max(220)).max(24).default([]),
});

const ENGLISH_LANGUAGE_NAMES: Record<LanguageCode, string> = {
  tr: "Turkish", en: "English", de: "German", ru: "Russian", fr: "French", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ar: "Arabic", ja: "Japanese", ko: "Korean", "zh-CN": "Chinese",
};

const generatedExamplesSchema = z.object({
  sentences: z.array(z.object({
    sentence: z.string().trim().min(12).max(120),
    translation: z.string().trim().min(12).max(150),
  }).strict()).length(3),
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

function parseGeneratedExamples(value: string, recentSentences: Set<string>): SelfExampleSentencesContent | null {
  try {
    const parsed = generatedExamplesSchema.safeParse(JSON.parse(extractJsonObject(value)));
    if (!parsed.success || !isSelfExampleSentencesContent(parsed.data)) return null;

    const sentences = parsed.data.sentences.map((entry) => normalizeSelfExampleSentence(entry.sentence));
    if (
      sentences.some((sentence) => recentSentences.has(sentence))
      || new Set(sentences).size !== sentences.length
      || parsed.data.sentences.some((entry) => !isSingleLine(entry.sentence) || !isSingleLine(entry.translation))
    ) {
      return null;
    }

    return { sentences: [parsed.data.sentences[0]!, parsed.data.sentences[1]!, parsed.data.sentences[2]!] };
  } catch {
    return null;
  }
}

async function createSelfExampleSentences({
  language,
  nativeLanguage,
  recentSentences,
}: {
  language: LanguageCode;
  nativeLanguage: LanguageCode;
  recentSentences: string[];
}) {
  const recentSentenceSet = new Set(recentSentences.map(normalizeSelfExampleSentence));
  const instructions = [
    "Create content for FoxiesDeck's Example Sentences (Self) social image.",
    "Return only one JSON object with exactly one field, sentences. Its value must be an array of exactly three objects, each with exactly these two fields: sentence and translation.",
    `Write three completely random, natural, useful ${ENGLISH_LANGUAGE_NAMES[language]} sentences. Each must be an independent everyday, travel, work, study, or social context; choose fresh topics and wording rather than building variations of one phrase.`,
    `For every sentence, write its faithful, natural meaning in ${ENGLISH_LANGUAGE_NAMES[nativeLanguage]} as translation. Keep sentence and translation on one line each, with no headings, markdown, quotes, CEFR labels, word definitions, emoji, or explanations.`,
    "Keep each source sentence under 120 characters and each translation under 150 characters so every pair remains clear on a social image. Do not repeat a sentence, a near-duplicate, or the same sentence pattern in this set.",
    recentSentences.length > 0
      ? `Do not use any of these recently generated sentences or close variants: ${recentSentences.join(" | ")}.`
      : "This is the first generation, so create a fresh set without relying on a fixed starter list.",
    "The source sentences and translations must be accurate, readable, and fully self-contained.",
  ].join("\n");

  const generate = async (repair: boolean) => {
    const { output } = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_CREATIVE_MODEL,
      (client, model, signal) => client.responses.create({
        model,
        instructions: repair
          ? `${instructions}\nYour previous answer was invalid or repeated a recent sentence. Create three completely different valid sentence pairs and return only the required JSON object.`
          : instructions,
        input: JSON.stringify({
          generator: "self-example-sentences",
          learningLanguage: ENGLISH_LANGUAGE_NAMES[language],
          nativeLanguage: ENGLISH_LANGUAGE_NAMES[nativeLanguage],
          recentSentences,
        }),
        max_output_tokens: 760,
        reasoning: { effort: "minimal" },
        store: false,
        text: { format: { type: "text" }, verbosity: "low" },
      }, { signal }),
      extractResponseOutputText,
    );
    return parseGeneratedExamples(output.trim(), recentSentenceSet);
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
    const examples = await createSelfExampleSentences(parsed.data);
    if (!examples) {
      return Response.json({
        errorCode: "invalid_example_sentences",
        diagnostic: createSocialStudioDiagnostic({
          stage: "Self example-sentences generation",
          provider: "PoYo Responses / Terra",
          fallbackDetail: "The generated sentence pairs were invalid or repeated recent sentences.",
        }),
      }, { status: 502 });
    }

    return Response.json({ examples }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      errorCode: getSocialStudioResponsesErrorCode(error) ?? "self_example_sentences_generation_failed",
      diagnostic: createSocialStudioDiagnostic({
        stage: "Self example-sentences generation",
        provider: getSocialStudioResponsesProviderLabel(error, "PoYo Responses / Terra"),
        error,
        fallbackDetail: "The AI could not create fresh sentence pairs.",
      }),
    }, { status: 502 });
  }
}
