import OpenAI from "openai";
import { LANGUAGE_BY_CODE } from "@/data/languages";
import {
  AI_PRACTICE_DEFAULT_MODEL,
  createAiPracticeSafetyIdentifier,
  extractResponseOutputText,
} from "@/features/ai-practice/ai-practice-openai";
import { aiPracticeTranslateRequestSchema } from "@/features/ai-practice/ai-practice-schema";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import {
  assertCanUseAi,
  recordAiUsageEvent,
} from "@/features/subscriptions/ai-usage-service";
import { getUserEntitlements } from "@/features/subscriptions/subscription-service";
import type { LanguageCode, LocaleCode } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OUTPUT_TOKENS = 260;

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();

  if (!user) {
    return Response.json({ errorCode: "auth_required" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json({ errorCode: "not_configured" }, { status: 503 });
  }

  const parsed = aiPracticeTranslateRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const entitlements = await getUserEntitlements(user.id);
  const aiLimitError = await assertCanUseAi(user.id, entitlements.effectivePlan);

  if (aiLimitError) {
    return Response.json({ errorCode: aiLimitError }, { status: 429 });
  }

  const targetLocale = getTranslationTargetLocale(parsed.data.language, parsed.data.targetLocale);
  const targetLanguageName = LANGUAGE_BY_CODE[targetLocale].nativeName;
  const sourceLanguageName = LANGUAGE_BY_CODE[parsed.data.language].nativeName;
  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_AI_PRACTICE_MODEL?.trim() || AI_PRACTICE_DEFAULT_MODEL;

  try {
    const response = await openai.responses.create({
      model,
      instructions: [
        "You are a direct translation engine for a language-learning chat.",
        `Source practice language: ${sourceLanguageName} (${parsed.data.language}).`,
        `Translate into: ${targetLanguageName} (${targetLocale}).`,
        "Return only the translated text. Do not add notes, quotes, explanations, labels, alternatives, or markdown.",
        "Keep casual tone, slang, typos, and message-like style when they are part of the source.",
      ].join("\n"),
      input: parsed.data.text,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      reasoning: { effort: "minimal" },
      store: false,
      text: { format: { type: "text" }, verbosity: "low" },
      truncation: "auto",
      safety_identifier: createAiPracticeSafetyIdentifier(user.id),
    });
    const translation = extractResponseOutputText(response).trim();

    if (!translation) {
      return Response.json({ errorCode: "empty_response" }, { status: 502 });
    }

    await recordAiUsageEvent(user.id, entitlements.effectivePlan, "translate");

    return Response.json(
      { translation, targetLocale },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return Response.json({ errorCode: "upstream_error" }, { status: 502 });
  }
}

function getTranslationTargetLocale(language: LanguageCode, targetLocale: LocaleCode): LocaleCode {
  if (targetLocale !== language) {
    return targetLocale;
  }

  return targetLocale === "en" ? "tr" : "en";
}
