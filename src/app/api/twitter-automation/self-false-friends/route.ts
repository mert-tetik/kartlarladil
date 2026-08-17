import { z } from "zod";
import { isLanguageCode } from "@/data/languages";
import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import {
  isSelfFalseFriendsContent,
  normalizeSelfFalseFriendsTerm,
  orderSelfFalseFriendsByTier,
  type SelfFalseFriendsContent,
} from "@/features/twitter-automation/self-false-friends";
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
export const maxDuration = 300;

const requestSchema = z.object({
  language: z.string().refine(isLanguageCode),
  nativeLanguage: z.string().refine(isLanguageCode),
  recentTerms: z.array(z.string().trim().min(1).max(80)).max(24).default([]),
});

const ENGLISH_LANGUAGE_NAMES: Record<LanguageCode, string> = {
  tr: "Turkish", en: "English", de: "German", ru: "Russian", fr: "French", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ar: "Arabic", ja: "Japanese", ko: "Korean", "zh-CN": "Chinese",
};

function extractJsonObject(value: string) {
  const withoutFence = value
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace ? withoutFence.slice(firstBrace, lastBrace + 1) : withoutFence;
}

function isSingleLine(value: string) {
  return !/[\r\n]/u.test(value);
}

const generatedPairSchema = z.object({
  firstTerm: z.string().trim().min(1).max(80).refine(isSingleLine),
  secondTerm: z.string().trim().min(1).max(80).refine(isSingleLine),
  firstTier: z.enum(["A1", "A2", "B1", "B2", "C1"]),
  secondTier: z.enum(["A1", "A2", "B1", "B2", "C1"]),
  firstExplanation: z.string().trim().min(12).max(130).refine(isSingleLine),
  secondExplanation: z.string().trim().min(12).max(130).refine(isSingleLine),
}).strict();

function parseGeneratedPair(value: string, recentTerms: Set<string>): SelfFalseFriendsContent | null {
  try {
    const parsed = generatedPairSchema.safeParse(JSON.parse(extractJsonObject(value)));
    if (!parsed.success || !isSelfFalseFriendsContent(parsed.data)) return null;

    const firstTerm = normalizeSelfFalseFriendsTerm(parsed.data.firstTerm);
    const secondTerm = normalizeSelfFalseFriendsTerm(parsed.data.secondTerm);
    if (
      firstTerm === secondTerm
      || recentTerms.has(firstTerm)
      || recentTerms.has(secondTerm)
      || parsed.data.firstExplanation === parsed.data.secondExplanation
    ) {
      return null;
    }

    return orderSelfFalseFriendsByTier(parsed.data);
  } catch {
    return null;
  }
}

async function createSelfFalseFriendsContent({
  language,
  nativeLanguage,
  recentTerms,
}: {
  language: LanguageCode;
  nativeLanguage: LanguageCode;
  recentTerms: string[];
}) {
  const recentTermSet = new Set(recentTerms.map(normalizeSelfFalseFriendsTerm));
  const instructions = [
    "Create content for FoxiesDeck's False Friends (Self) social image.",
    "In this product, False Friends means two words from the selected learning language that have a related core meaning but different nuance. It does not mean cross-language false cognates.",
    "Return only one JSON object with exactly these six fields: firstTerm, secondTerm, firstTier, secondTier, firstExplanation, secondExplanation.",
    `Choose two real, useful, distinct ${ENGLISH_LANGUAGE_NAMES[language]} words completely at random. They must share a meaning area but differ clearly in intensity, register, scope, typical situation, or emotional force. For example, a pair can resemble angry/furious, but choose a fresh pair yourself; never reuse an example from this instruction as a default choice.`,
    "Set firstTier and secondTier independently to the accurate CEFR level for each selected word. Each tier must be exactly one of A1, A2, B1, B2, or C1; use common learner difficulty, not a copied or matching level by default.",
    "Never choose a translation pair, antonyms, spelling variants, homophones, words that only look alike, or two interchangeable synonyms. Never include a native-language word as either term.",
    `Write firstExplanation and secondExplanation as one very short, natural sentence each in ${ENGLISH_LANGUAGE_NAMES[nativeLanguage]}. Keep each explanation under 130 characters; state the meaning and its difference from the other word with no extra detail. Do not add headings, markdown, quotes, CEFR labels, or emoji.`,
    recentTerms.length > 0
      ? `Do not use any of these terms because they appeared in recent generations: ${recentTerms.join(", ")}.`
      : "This is the first generation, so choose a fresh pair without relying on a fixed starter list.",
    "The terms and explanations must be accurate, social-media readable, and fully self-contained.",
  ].join("\n");

  const generate = async (repair: boolean) => {
    const { output } = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_CREATIVE_MODEL,
      (client, model, signal) => client.responses.create({
        model,
        instructions: repair
          ? `${instructions}\nYour previous answer was invalid or repeated a recent term. Choose a completely different valid pair and return only the required JSON object.`
          : instructions,
        input: JSON.stringify({
          generator: "self-false-friends",
          learningLanguage: ENGLISH_LANGUAGE_NAMES[language],
          nativeLanguage: ENGLISH_LANGUAGE_NAMES[nativeLanguage],
          recentTerms,
        }),
        max_output_tokens: 420,
        reasoning: { effort: "minimal" },
        store: false,
        text: { format: { type: "text" }, verbosity: "low" },
      }, { signal }),
      extractResponseOutputText,
    );
    return parseGeneratedPair(output.trim(), recentTermSet);
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
    const pair = await createSelfFalseFriendsContent(parsed.data);
    if (!pair) {
      return Response.json({
        errorCode: "invalid_false_friends_pair",
        diagnostic: createSocialStudioDiagnostic({
          stage: "Self false-friends generation",
          provider: "PoYo Responses / Terra",
          fallbackDetail: "The generated word pair was invalid or repeated a recent term.",
        }),
      }, { status: 502 });
    }

    return Response.json({ pair }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      errorCode: getSocialStudioResponsesErrorCode(error) ?? "self_false_friends_generation_failed",
      diagnostic: createSocialStudioDiagnostic({
        stage: "Self false-friends generation",
        provider: getSocialStudioResponsesProviderLabel(error, "PoYo Responses / Terra"),
        error,
        fallbackDetail: "The AI could not create a fresh word pair.",
      }),
    }, { status: 502 });
  }
}
