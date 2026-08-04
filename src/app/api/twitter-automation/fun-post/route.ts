import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import { isLanguageCode } from "@/data/languages";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { assertPoyoResponsesOutput, createSocialStudioPoyoClient, PoyoResponsesProviderError, SOCIAL_CONTENT_TEXT_MODEL } from "@/features/twitter-automation/social-studio-poyo";
import { createSocialStudioDiagnostic } from "@/features/twitter-automation/social-studio-diagnostics";
import type { LanguageCode } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_INSTRUCTIONS = [
  "Write one short, playful X post promoting FoxiesDeck.",
  "FoxiesDeck is a multilingual vocabulary-learning app where learners collect words as cards and review them later.",
  "Write the post and its explanations in the selected native language. Use the selected learning language only for vocabulary examples, questions, and target-language phrases.",
  "Include one or two natural emojis and end with 2 or 3 relevant hashtags, including #languagelearning.",
  "Stay below 260 characters. Return only the post text. Never use an em dash or an en dash; use commas or full stops instead.",
  "If the post asks followers a question, quiz, or challenge, never reveal, state, or hint at the answer. Leave the answer for comments and engagement.",
];

const CONTENT_RULES = {
  "fun-post": "Write a genuinely funny, scroll-stopping Gen Z FoxiesDeck post. Use a sharp, specific, self-aware language-learning observation, a small unexpected twist, or a relatable learner fail, then land on a concise punchline. It should feel like a witty human who actually studies languages wrote it, not a generic motivational brand. Keep the humor warm, never mean or cringe. For English-native posts, use Gen Z internet language naturally and sparingly, at most one or two cues: use 'lol' for light irony or a deadpan aside, 'lmao' only for a genuinely absurd or highly funny moment, 😭 for exaggerated laughter, disbelief, or overwhelmed feelings, 💔 for playful over-the-top disappointment, and 'damn' or 'dayum' for an impressed or shocked emphasis. Never stack every slang term, define slang, force it into formal copy, or use it to insult anyone. For non-English native posts, use an equally natural local casual tone instead of forcing English slang. Mention FoxiesDeck or one concrete product benefit naturally, only if it improves the joke. Avoid bland claims such as 'make learning fun', 'unlock your potential', or 'start your journey'.",
  "word-quiz": "Create a quick multiple-choice vocabulary quiz with one question and exactly four choices, labelled A, B, C, and D. Randomly choose the vocabulary difficulty from CEFR A1, A2, B1, or B2 for each post. Never use C1 vocabulary. Do not reveal or hint at the answer.",
  "language-tip": "Write only one practical grammar, usage, or pronunciation tip for the selected learning language, with one tiny correct example. Do not mention FoxiesDeck, the app, cards, decks, reviewing, product benefits, or any call to action. End with two or three relevant language hashtags, including #languagelearning. The entire post should be the tip and its hashtags, nothing else.",
  "false-friends": "Explain two easy-to-confuse words or a false-friend pair in a memorable, simple way.",
  "daily-challenge": "Set a friendly daily challenge to learn three useful words, with the words included.",
  "relatable-learner": "Write a funny, highly relatable language-learning observation without sounding mean or corporate.",
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
    const response = await createSocialStudioPoyoClient().responses.create({
      model: SOCIAL_CONTENT_TEXT_MODEL,
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
    });
    assertPoyoResponsesOutput(response);
    const output = extractResponseOutputText(response).trim();
    const post = output;

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
