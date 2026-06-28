import OpenAI from "openai";
import { AI_PRACTICE_DEFAULT_MODEL } from "@/features/ai-practice/ai-practice-openai";
import { aiValidateAnswerRequestSchema } from "@/features/quiz/ai-validate-answer-schema";
import { parseAiValidationResponse } from "@/features/quiz/ai-validate-answer-parser";
import { getLanguageDisplayName } from "@/i18n/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_OUTPUT_TOKENS = 128;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json({ accepted: false }, { status: 503 });
  }

  const parsed = aiValidateAnswerRequestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return Response.json({ accepted: false }, { status: 400 });
  }

  const { userAnswer, correctAnswers, targetLanguage, sourceLanguage, promptContext } =
    parsed.data;

  const targetLanguageName = getLanguageDisplayName(targetLanguage, "en");
  const sourceLanguageName = getLanguageDisplayName(sourceLanguage, "en");

  const systemContent = [
    "You are a helpful language tutor validating a vocabulary quiz answer.",
    `The user is learning ${targetLanguageName}; the quiz UI is in ${sourceLanguageName}.`,
    `They were asked to produce the target word or phrase in ${targetLanguageName}.`,
    "",
    "Accept the user's answer if it matches any of these:",
    "- Exact match or minor typo.",
    "- A correct inflection of the target word (e.g., run -> ran).",
    "- A close synonym or semantic equivalent that preserves the core meaning in this context (e.g., warm -> hot, big -> huge).",
    "",
    "Reject the answer if it is:",
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
    'Correct: run, User: walk -> {"accepted": false}',
    'Correct: big, User: huge -> {"accepted": true}',
    'Correct: big, User: small -> {"accepted": false}',
  ].join("\n");

  const userContent = [
    `Correct answers: ${correctAnswers.join(", ")}`,
    `Target language: ${targetLanguageName}`,
    `UI language: ${sourceLanguageName}`,
    `Context: ${promptContext}`,
    `User answer: ${userAnswer}`,
  ].join("\n");

  const openai = new OpenAI({ apiKey });
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
