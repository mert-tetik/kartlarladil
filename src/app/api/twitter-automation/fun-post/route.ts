import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import { isLanguageCode } from "@/data/languages";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSocialStudioPoyoClient, generateSocialStudioTextWithFallback, PoyoResponsesProviderError, SOCIAL_CONTENT_TEXT_MODEL } from "@/features/twitter-automation/social-studio-poyo";
import { createSocialStudioDiagnostic } from "@/features/twitter-automation/social-studio-diagnostics";
import type { LanguageCode } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_INSTRUCTIONS = [
  "Write one short X post for the selected mode.",
  "Write the post and explanations in the selected native language. Use the selected learning language only for vocabulary examples, questions, and target-language phrases.",
  "Use 2-4 relevant emojis generously and naturally throughout the post.",
  "Always put hashtags on their own final line, separated from the content by a blank line. End with 2 or 3 relevant hashtags, including #languagelearning.",
  "Stay below 280 characters. Return only the post text. Never use an em dash or an en dash; use commas or full stops instead.",
  "If the post asks followers a question, quiz, or challenge, never reveal, state, or hint at the answer. Leave the answer for comments and engagement.",
  "Do not promote FoxiesDeck, the app, cards, decks, reviewing, or any product benefit unless the mode specifically asks for it.",
];

const CONTENT_RULES = {
  "fun-post": "Write one short, playful X post promoting FoxiesDeck. FoxiesDeck is a multilingual vocabulary-learning app where learners collect words as cards and review them later. Use a genuinely funny, scroll-stopping Gen Z observation, a small unexpected twist, or a relatable learner fail, then land on a concise punchline. It should feel like a witty human who actually studies languages wrote it, not a generic motivational brand. Keep the humor warm, never mean or cringe. Mention FoxiesDeck or one concrete product benefit naturally, only if it improves the joke. Avoid bland claims such as 'make learning fun', 'unlock your potential', or 'start your journey'.",
  "word-quiz": "Create a quick multiple-choice vocabulary quiz in the selected learning language. Start directly with the question on its own line. Put each choice A), B), C), D) on its own line. After the last choice, add a blank line and then write a native-language line like 'Write the answer in the comments!' (e.g. 'Cevabı yorumlara yaz!'). Add another blank line and put the hashtags on their own final line. Never reveal or hint at the answer.",
  "language-tip": "Write one practical grammar, usage, or pronunciation tip for the selected learning language, with one tiny correct example. No FoxiesDeck marketing. Use emojis.",
  "false-friends": "Pick two words in the selected learning language that are close in meaning but not identical (for example, different intensity, register, or nuance). Explain the difference between them clearly and concisely. Do not give the words to the model; choose them yourself. Put each word on its own line with its meaning, then the explanation on separate short lines for readability. No FoxiesDeck marketing.",
  "daily-challenge": "Set a friendly daily challenge with three useful words in the selected learning language, each with its meaning. List each word and meaning on its own line. End with one native-language line inviting the reader to add the words to their FoxiesDeck collection to remember them. No extra marketing claims.",
  "relatable-learner": "Write a funny, highly relatable language-learning observation without sounding mean or corporate. No FoxiesDeck marketing. Use emojis.",
  "tiered-vocabulary": "Show one idea in three difficulty levels: A1, B2, and C1. Give a single word or phrase for each level in the selected learning language. Put each level and its example on its own line. No FoxiesDeck marketing. Use emojis.",
  "example-sentences": "Provide three natural example sentences in the selected learning language, each followed by its meaning in the native language on a new line. No FoxiesDeck marketing. Use emojis.",
} as const;

type ContentMode = keyof typeof CONTENT_RULES;

const ENGLISH_LANGUAGE_NAMES: Record<LanguageCode, string> = {
  tr: "Turkish", en: "English", de: "German", ru: "Russian", fr: "French", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ar: "Arabic", ja: "Japanese", ko: "Korean", "zh-CN": "Chinese",
};

function isContentMode(value: unknown): value is ContentMode {
  return typeof value === "string" && value in CONTENT_RULES;
}

export async function POST(request: Request) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) {
    return Response.json({ errorCode: "unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({})) as { mode?: unknown; language?: unknown; nativeLanguage?: unknown };
  const mode = payload.mode === undefined ? "fun-post" : payload.mode;
  const learningLanguage = typeof payload.language === "string" && isLanguageCode(payload.language) ? payload.language : null;
  const nativeLanguage = typeof payload.nativeLanguage === "string" && isLanguageCode(payload.nativeLanguage) ? payload.nativeLanguage : null;
  if (!isContentMode(mode) || !learningLanguage || !nativeLanguage) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  if (!process.env.POYO_API_KEY?.trim()) {
    return Response.json({ errorCode: "poyo_not_configured" }, { status: 503 });
  }

  try {
    const poyo = createSocialStudioPoyoClient();
    const { output } = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_TEXT_MODEL,
      (model) => poyo.responses.create({
      model,
      instructions: [...BASE_INSTRUCTIONS, CONTENT_RULES[mode]].join("\n"),
      input: JSON.stringify({
        mode,
        learningLanguage: ENGLISH_LANGUAGE_NAMES[learningLanguage],
        nativeLanguage: ENGLISH_LANGUAGE_NAMES[nativeLanguage],
      }),
      max_output_tokens: 120,
      reasoning: { effort: "none" },
      store: false,
      text: { format: { type: "text" }, verbosity: "low" },
      }),
      extractResponseOutputText,
    );
    const post = output.trim();

    if (!post) {
      return Response.json({
        errorCode: "empty_response",
        diagnostic: createSocialStudioDiagnostic({ stage: "Text post response validation", provider: "PoYo Responses / Luna", fallbackDetail: "The provider returned an empty post." }),
      }, { status: 502 });
    }

    return Response.json({ post });
  } catch (error) {
    return Response.json({
      errorCode: error instanceof PoyoResponsesProviderError ? "poyo_responses_provider_error" : "upstream_error",
      diagnostic: createSocialStudioDiagnostic({ stage: "Text post generation", provider: "PoYo Responses / Luna", error, fallbackDetail: "The text-generation request failed." }),
    }, { status: 502 });
  }
}
