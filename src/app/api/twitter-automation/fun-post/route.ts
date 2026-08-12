import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import { randomInt } from "node:crypto";
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
  "Return plain text only. Never use Markdown formatting, including asterisks for bold or italics, headings, code fences, block quotes, or Markdown links.",
  "If the post asks followers a question, quiz, or challenge, never reveal, state, or hint at the answer. Leave the answer for comments and engagement.",
  "Do not promote FoxiesDeck, the app, cards, decks, reviewing, or any product benefit unless the mode specifically asks for it.",
  "The content must be completely random. Do not repeat any word, sentence, example, or false-friend pair used in previous generations, even when this request runs immediately after another one.",
];

const CONTENT_RULES = {
  "fun-post": "Write one short, playful, shareable X post about FoxiesDeck, the selected learning language, or the experience of learning that language. The central subject is completely free and does not need to be a vocabulary word, translation, or false friend. Follow the supplied creative direction, then invent a fresh specific premise instead of defaulting to a familiar word or example. Build a clear miniature story in this order: setup, the learner's realisation or contrast, then one concise punchline or natural FoxiesDeck action. Every sentence must follow logically from the sentence before it, with an unambiguous subject and a clear payoff. When a joke uses a specific word, phrase, translation, false friend, grammar point, or pronunciation, every linguistic claim must be factually accurate. Never build a joke on a false meaning or a contradiction; if you mention a false friend, make both the common misreading and the real meaning explicit and correct. Do not use random surreal metaphors, vague emotional-support jokes, or a punchline that changes the topic. Put every sentence or complete thought on its own line for easy scanning; never place two sentences on the same content line. Use a genuinely funny, scroll-stopping Gen Z observation, a small unexpected twist, or a relatable learner fail. Write in the selected native language's natural, current Gen Z internet voice. Every post must include at least one authentic local Gen Z or online-slang expression and at least one locally natural shortened word or abbreviation. For Turkish, examples include 'yapıyo' instead of 'yapıyor' or 'bi' instead of 'bir'. Do not force English slang or invented abbreviations into another language. Be deliberately relaxed with punctuation and grammar, as in a real casual post, while keeping the meaning coherent. When showing laughter or being overwhelmed, use 😭 and/or 💀 rather than laughing-face emojis. It should feel like a witty human who actually studies languages wrote it, not a generic motivational brand. Keep the humor warm, never mean or cringe. Mention FoxiesDeck or one concrete product benefit naturally, only if it improves the joke. Avoid bland claims such as 'make learning fun', 'unlock your potential', or 'start your journey'.",
  "word-quiz": "Create a quick multiple-choice vocabulary quiz about the selected learning language. The question sentence and every instruction must be written in the selected native language. Use the selected learning language only for the target word or phrase being quizzed and, where natural, the answer choices. Start directly with the native-language question on its own line. Put each choice A), B), C), D) on its own line. After the last choice, add a blank line and then write a native-language line like 'Write the answer in the comments!' (e.g. 'Cevabı yorumlara yaz!'). Add another blank line and put the hashtags on their own final line. Never reveal or hint at the answer.",
  "language-tip": "Write one practical grammar, usage, or pronunciation tip for the selected learning language, with one tiny correct example. No FoxiesDeck marketing. Use emojis.",
  "false-friends": "Create a concise comparison of exactly two real, useful words from the selected learning language that share a meaning area but are not interchangeable. This is a nuance comparison, not a comparison of deceptive cognates or unrelated words. Pick the pair yourself completely at random, such as two words that both express anger but differ in intensity, register, scope, typical situation, or emotional force. State each word and its short native-language meaning, then clearly explain in the selected native language when and why one word differs from the other. For example, a pair like angry and furious must make the difference in strength clear, but never default to that pair. Put each word on its own line and use short separate lines for the contrast so it is easy to scan. No FoxiesDeck marketing.",
  "daily-challenge": "Set a friendly daily challenge with three useful words in the selected learning language, each with its meaning in the selected native language. List each word and meaning on its own separate line in exactly this plain-text format: target word = native-language meaning. Use an equals sign with one space on each side, never a comma, colon, dash, bullet, or Markdown formatting. End with one native-language line inviting the reader to add the words to their FoxiesDeck collection to remember them. No extra marketing claims.",
  "relatable-learner": "Write one short, funny, highly relatable post about the selected learning language or the experience of learning it. Follow the supplied creative direction and invent a concrete, fresh situation around it. On consecutive generations, change the situation, joke structure, punchline, and wording completely rather than paraphrasing a familiar language-learning joke. Do not default to generic jokes about forgetting a word, Duolingo-style streaks, or a brain that stops working unless the supplied direction specifically calls for one. Write in the selected native language's natural, current Gen Z internet voice. Every post must include at least one authentic local Gen Z or online-slang expression and at least one locally natural shortened word or abbreviation. For Turkish, examples include 'yapıyo' instead of 'yapıyor' or 'bi' instead of 'bir'. Do not force English slang or invented abbreviations into another language. Be deliberately relaxed with punctuation and grammar, as in a real casual post, while keeping the meaning coherent. When showing laughter or being overwhelmed, use 😭 and/or 💀 rather than laughing-face emojis. Keep the humour warm, specific, and recognisably human, never mean or corporate. No FoxiesDeck marketing.",
  "tiered-vocabulary": "Show one idea in three difficulty levels: A1, B2, and C1. Give a single word or phrase for each level in the selected learning language. Put each level and its example on its own line. No FoxiesDeck marketing. Use emojis.",
  "example-sentences": "Provide three natural example sentences in the selected learning language, each followed by its meaning in the native language on a new line. No FoxiesDeck marketing. Use emojis.",
} as const;

type ContentMode = keyof typeof CONTENT_RULES;

const FUN_POST_CREATIVE_DIRECTIONS = [
  "a tiny confidence crash during a real conversation",
  "the brain mixing languages at exactly the wrong moment",
  "pronunciation confidence that is much higher than pronunciation accuracy",
  "a study streak meeting ordinary daily chaos",
  "the oddly competitive urge to collect one more useful word",
  "a subtitle, song, film, or social-media moment that becomes an unexpected language lesson",
  "the gap between understanding a word and using it under pressure",
  "an autocorrect, keyboard, or voice-note misunderstanding while learning",
  "a satisfying tiny language-learning win that is treated dramatically",
  "the contrast between textbook confidence and real-life conversation",
  "the moment a familiar-looking phrase means something unexpectedly different",
  "a harmless learner habit that only other language learners would recognise",
] as const;

const RELATABLE_LEARNER_CREATIVE_DIRECTIONS = [
  "an overly confident pronunciation attempt meeting a real listener",
  "switching between two languages mid-sentence without noticing",
  "recognising a word in a song or subtitle but freezing when asked to say it",
  "trying to use a newly learned phrase in an ordinary real-life situation",
  "a harmless autocorrect or keyboard mishap in the selected learning language",
  "the awkward gap between reading a sentence perfectly and speaking it aloud",
  "a silent letter, unexpected spelling, or misleading pronunciation pattern",
  "replaying the same short clip because one fast sentence escaped",
  "suddenly noticing the selected learning language everywhere after studying it",
  "learning a very specific word before knowing a much more basic one",
  "trying to think directly in the selected learning language and accidentally creating a strange sentence",
  "the dramatic satisfaction of understanding a tiny everyday phrase without translating",
  "a polite phrase being used at the wrong level of formality",
  "mixing up two almost-identical useful words at the most inconvenient moment",
  "a dictionary lookup that sends the learner down an unnecessary rabbit hole",
  "a familiar phrase sounding completely different when spoken naturally",
] as const;

let lastRelatableLearnerCreativeDirection: string | undefined;

function getFunPostCreativeDirection() {
  return FUN_POST_CREATIVE_DIRECTIONS[randomInt(FUN_POST_CREATIVE_DIRECTIONS.length)];
}

function getRelatableLearnerCreativeDirection() {
  const eligibleDirections = RELATABLE_LEARNER_CREATIVE_DIRECTIONS.filter((direction) => direction !== lastRelatableLearnerCreativeDirection);
  const direction = eligibleDirections[randomInt(eligibleDirections.length)];
  lastRelatableLearnerCreativeDirection = direction;
  return direction;
}

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
        ...(mode === "fun-post"
          ? { creativeDirection: getFunPostCreativeDirection() }
          : mode === "relatable-learner"
            ? { creativeDirection: getRelatableLearnerCreativeDirection() }
            : {}),
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
