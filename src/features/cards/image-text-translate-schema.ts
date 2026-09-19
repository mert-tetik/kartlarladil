import { z } from "zod";
import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";

export const IMAGE_TEXT_MODES = ["image", "text"] as const;
export const imageTextModeSchema = z.enum(IMAGE_TEXT_MODES);
export type ImageTextMode = z.infer<typeof imageTextModeSchema>;

const imageDataUrlSchema = z
  .string()
  .regex(/^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Unsupported image data URL");

export const imageTextTranslateRequestSchema = z.object({
  mode: imageTextModeSchema,
  locale: z.enum(LOCALE_CODES),
  targetLanguage: z.enum(LANGUAGE_CODES),
  text: z.string().trim().max(4000).optional(),
  images: z.array(imageDataUrlSchema).max(6).optional(),
}).superRefine((value, context) => {
  if (value.mode === "image" && (!value.images || value.images.length === 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["images"], message: "At least one image is required" });
  }

  if (value.mode === "text" && !value.text?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["text"], message: "Text is required" });
  }
});

export type ImageTextTranslateRequest = z.infer<typeof imageTextTranslateRequestSchema>;

export const imageTextTranslationEntrySchema = z.object({
  id: z.string().min(1).max(80),
  source: z.string().trim().min(1).max(120),
  translation: z.string().trim().min(1).max(240),
  meaning: z.string().trim().min(1).max(300),
});

export const imageTextQuestionAnswerSchema = z.object({
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(500),
  translatedQuestion: z.string().trim().min(1).max(500),
  translatedAnswer: z.string().trim().min(1).max(500),
});

export const imageTextTranslateResponseSchema = z.object({
  detectedText: z.string().max(8000),
  translatedText: z.string().max(8000),
  questionAnswers: z.array(imageTextQuestionAnswerSchema).max(20),
  entries: z.array(imageTextTranslationEntrySchema).max(80),
});

export type ImageTextTranslationEntry = z.infer<typeof imageTextTranslationEntrySchema>;
export type ImageTextTranslateResponse = z.infer<typeof imageTextTranslateResponseSchema>;

export function normalizeImageTextTranslateResponse(value: ImageTextTranslateResponse): ImageTextTranslateResponse {
  const seen = new Set<string>();
  const entries = value.entries.filter((entry) => {
    const key = entry.source.trim().toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((entry, index) => ({
    ...entry,
    id: `entry-${index + 1}`,
  }));

  let detectedText = value.detectedText.trim();
  let translatedText = value.translatedText.trim();

  for (const questionAnswer of value.questionAnswers) {
    detectedText = appendAnswerAfterQuestion(
      detectedText,
      questionAnswer.question,
      questionAnswer.answer,
    );
    translatedText = appendAnswerAfterQuestion(
      translatedText,
      questionAnswer.translatedQuestion,
      questionAnswer.translatedAnswer,
    );
  }

  return {
    detectedText,
    translatedText,
    questionAnswers: value.questionAnswers,
    entries,
  };
}

function appendAnswerAfterQuestion(text: string, question: string, answer: string) {
  if (!text || text.includes(answer)) return text;

  const questionIndex = text.indexOf(question);
  if (questionIndex < 0) return `${text}\n\n${question}\n${answer}`.trim();

  const questionEnd = questionIndex + question.length;
  const lineBreakIndex = text.indexOf("\n", questionEnd);
  const insertionIndex = lineBreakIndex < 0 ? text.length : lineBreakIndex;
  return `${text.slice(0, insertionIndex)}\n${answer}${text.slice(insertionIndex)}`;
}
