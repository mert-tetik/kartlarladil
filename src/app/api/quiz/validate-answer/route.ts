import { OpenAI } from "openai";
import { AI_PRACTICE_DEFAULT_MODEL } from "@/features/ai-practice/ai-practice-openai";
import { aiValidateAnswerRequestSchema } from "@/features/quiz/ai-validate-answer-schema";
import { parseAiValidationResponse } from "@/features/quiz/ai-validate-answer-parser";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { assertAndRecordAiUsage } from "@/features/subscriptions/ai-usage-service";
import { getUserEntitlements } from "@/features/subscriptions/subscription-service";
import { getLanguageDisplayName } from "@/i18n/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_OUTPUT_TOKENS = 128;

function normalizeValidationText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, "")
    .replace(/\s+/g, " ");
}

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();

  if (!user) {
    return Response.json({ errorCode: "auth_required" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json({ accepted: false }, { status: 503 });
  }

  const entitlements = await getUserEntitlements(user.id);
  const aiLimitError = await assertAndRecordAiUsage(user.id, entitlements.effectivePlan, "quiz_validate");

  if (aiLimitError) {
    return Response.json({ errorCode: aiLimitError }, { status: 429 });
  }

  const parsed = aiValidateAnswerRequestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return Response.json({ accepted: false }, { status: 400 });
  }

  const {
    validationKind,
    userAnswer,
    correctAnswers,
    sourceAnswers,
    targetLanguage,
    sourceLanguage,
    promptContext,
  } = parsed.data;

  const targetLanguageName = getLanguageDisplayName(targetLanguage, "en");
  const sourceLanguageName = getLanguageDisplayName(sourceLanguage, "en");
  const normalizedUserAnswer = normalizeValidationText(userAnswer);
  const normalizedSourceAnswers = new Set(sourceAnswers.map(normalizeValidationText));

  if (normalizedSourceAnswers.has(normalizedUserAnswer)) {
    return Response.json({ accepted: false });
  }

  const textAnswerSystemContent = [
    "You are a helpful language tutor validating a vocabulary quiz answer.",
    `The user is learning ${targetLanguageName}; the quiz UI is in ${sourceLanguageName}.`,
    `They were asked to produce the target word or phrase in ${targetLanguageName}.`,
    "",
    "Accept the user's answer if it matches any of these:",
    "- Exact match or minor typo.",
    "- Another valid inflectional or lemma form of the same word in either direction (e.g., run -> ran, ran -> run, find -> found, found -> find).",
    "- A close synonym or semantic equivalent that preserves the core meaning in this context (e.g., warm -> hot, big -> huge).",
    "",
    "Reject the answer if it is:",
    `- Written in ${sourceLanguageName} instead of ${targetLanguageName}.`,
    "- A translation, paraphrase, or explanation in the source/UI language.",
    "- A mixed-language answer that includes source-language wording.",
    "- An antonym or opposite meaning (e.g., warm -> cold).",
    "- A related but different word that changes the core meaning (e.g., run -> walk).",
    "- Unrelated or clearly wrong.",
    "",
    "Respond ONLY with a JSON object and no other text:",
    '{"accepted": true}',
    'or',
    '{"accepted": false}',
    "",
    "Examples:",
    'Correct: warm, User: hot -> {"accepted": true}',
    'Correct: warm, User: cold -> {"accepted": false}',
    'Correct: run, User: ran -> {"accepted": true}',
    'Correct: ran, User: run -> {"accepted": true}',
    'Correct: found, User: find -> {"accepted": true}',
    'Correct: run, User: walk -> {"accepted": false}',
    'Correct: big, User: huge -> {"accepted": true}',
    'Correct: big, User: small -> {"accepted": false}',
  ].join("\n");

  const sentenceCompletionSystemContent = [
    "You are a helpful language tutor validating a sentence-completion quiz answer.",
    `The blank must be completed in ${targetLanguageName}; the quiz UI is in ${sourceLanguageName}.`,
    "Decide whether the user's selected word or phrase makes the provided sentence grammatical, natural, and plausible in its visible context.",
    "Do not require the selection to match the canonical answer or preserve its exact meaning.",
    "For example, if the canonical sentence is 'I drink tea.' and the user completes it as 'I drink coffee.', accept it.",
    "",
    "Accept only when the completed sentence is natural and grammatically valid in the target language.",
    "Reject source/UI-language answers, mixed-language answers, ungrammatical completions, unnatural completions, or answers that contradict explicit context.",
    "Never accept a choice merely because it is loosely related to the canonical answer.",
    "",
    'Respond ONLY with {"accepted": true} or {"accepted": false}.',
  ].join("\n");

  const systemContent = validationKind === "sentence_completion"
    ? sentenceCompletionSystemContent
    : textAnswerSystemContent;

  const userContent = [
    `Correct answers: ${correctAnswers.join(", ")}`,
    `Source-language answers to reject: ${sourceAnswers.join(", ")}`,
    `Target language: ${targetLanguageName}`,
    `UI language: ${sourceLanguageName}`,
    `Context: ${promptContext}`,
    `User answer: ${userAnswer}`,
  ].join("\n");

  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: process.env.NODE_ENV === "test",
  });
  const model = process.env.OPENAI_AI_PRACTICE_MODEL?.trim() || AI_PRACTICE_DEFAULT_MODEL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await openai.responses.create(
      {
        model,
        input: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
        max_output_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: "minimal" },
        store: false,
      },
      { signal: controller.signal },
    );

    const raw = response.output_text?.trim() ?? "";
    const accepted = parseAiValidationResponse(raw);

    return Response.json({ accepted });
  } catch {
    return Response.json({ accepted: false }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
}
