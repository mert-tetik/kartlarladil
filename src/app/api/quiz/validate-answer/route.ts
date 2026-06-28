import OpenAI from "openai";
import { AI_PRACTICE_DEFAULT_MODEL } from "@/features/ai-practice/ai-practice-openai";
import { aiValidateAnswerRequestSchema } from "@/features/quiz/ai-validate-answer-schema";
import { getLanguageDisplayName } from "@/i18n/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 3_000;
const MAX_OUTPUT_TOKENS = 8;

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
    "You are a strict language quiz validator.",
    `The user is learning ${targetLanguageName} from ${sourceLanguageName}.`,
    `They were asked to translate a word/phrase into ${targetLanguageName}.`,
    "Accept only exact synonyms or very close semantic equivalents.",
    "Reject typos, partial matches, and related-but-different words.",
    "Respond with exactly one lowercase letter and nothing else:",
    "'t' if the user's answer should be accepted as correct,",
    "'y' if it should be rejected as wrong.",
  ].join(" ");

  const userContent = [
    `Correct answers: ${correctAnswers.join(", ")}`,
    `Context: ${promptContext}`,
    `User answer: ${userAnswer}`,
  ].join("\n");

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_AI_PRACTICE_MODEL?.trim() || AI_PRACTICE_DEFAULT_MODEL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const completion = await openai.chat.completions.create(
      {
        model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0,
      },
      { signal: controller.signal },
    );

    const raw = completion.choices[0]?.message?.content?.trim().toLowerCase() ?? "y";
    const accepted = raw.includes("t") && !raw.includes("y");

    return Response.json({ accepted });
  } catch {
    return Response.json({ accepted: false }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
}
