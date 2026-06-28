import type { AiValidateAnswerRequest, AiValidateAnswerResponse } from "@/features/quiz/ai-validate-answer-schema";
import type { LanguageCode } from "@/types/domain";

const API_ROUTE = "/api/quiz/validate-answer";
const CLIENT_TIMEOUT_MS = 3_500;

export interface AiValidateTextAnswerOptions {
  userAnswer: string;
  correctAnswers: string[];
  targetLanguage: LanguageCode;
  sourceLanguage: LanguageCode;
  promptContext: string;
}

export async function aiValidateTextAnswer(
  options: AiValidateTextAnswerOptions,
): Promise<{ accepted: boolean }> {
  const body: AiValidateAnswerRequest = {
    userAnswer: options.userAnswer.trim(),
    correctAnswers: options.correctAnswers.map((answer) => answer.trim()),
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

    const data = (await response.json().catch(() => ({ accepted: false }))) as AiValidateAnswerResponse;
    return { accepted: data.accepted === true };
  } catch {
    return { accepted: false };
  } finally {
    window.clearTimeout(timeout);
  }
}
