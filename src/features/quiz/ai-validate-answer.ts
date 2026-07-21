import type {
  AiValidateAnswerRequest,
  AiValidateAnswerResponse,
  AiValidationKind,
} from "@/features/quiz/ai-validate-answer-schema";
import type { LanguageCode } from "@/types/domain";

const API_ROUTE = "/api/quiz/validate-answer";
const CLIENT_TIMEOUT_MS = 5_500;

export interface AiValidateTextAnswerOptions {
  validationKind?: AiValidationKind;
  userAnswer: string;
  correctAnswers: string[];
  sourceAnswers: string[];
  targetLanguage: LanguageCode;
  sourceLanguage: LanguageCode;
  promptContext: string;
}

export async function aiValidateTextAnswer(
  options: AiValidateTextAnswerOptions,
): Promise<{ accepted: boolean; errorCode?: "ai_daily_limit" | "ai_monthly_limit" }> {
  const body: AiValidateAnswerRequest = {
    validationKind: options.validationKind ?? "text",
    userAnswer: options.userAnswer.trim(),
    correctAnswers: options.correctAnswers.map((answer) => answer.trim()),
    sourceAnswers: options.sourceAnswers.map((answer) => answer.trim()),
    targetLanguage: options.targetLanguage,
    sourceLanguage: options.sourceLanguage,
    promptContext: options.promptContext.trim(),
  };

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch(API_ROUTE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 429) {
      const data = (await response.json().catch(() => ({ errorCode: "ai_daily_limit" }))) as AiValidateAnswerResponse;
      return {
        accepted: false,
        errorCode: data.errorCode === "ai_monthly_limit" ? "ai_monthly_limit" : "ai_daily_limit",
      };
    }

    const data = (await response.json().catch(() => ({ accepted: false }))) as AiValidateAnswerResponse;
    return { accepted: data.accepted === true, errorCode: data.errorCode };
  } catch {
    return { accepted: false };
  } finally {
    window.clearTimeout(timeout);
  }
}
