import { z } from "zod";
import { TIERS } from "@/data/tiers";
import { isLanguageCode } from "@/data/languages";
import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { generatePoyoImageEdit, PoyoImageError } from "@/features/twitter-automation/poyo-image-generation";
import { generateSocialStudioTextWithFallback, getSocialStudioResponsesErrorCode, getSocialStudioResponsesProviderLabel, SOCIAL_CONTENT_CREATIVE_MODEL } from "@/features/twitter-automation/social-studio-poyo";
import { createSocialStudioDiagnostic } from "@/features/twitter-automation/social-studio-diagnostics";
import { createNativeVisualCaption, finalizeNativeCaption, getNativeCaptionHashtags } from "@/features/twitter-automation/social-video-titles";
import { resolveSocialStudioVocabularyCard, selectSocialStudioVocabularyTerms, SocialStudioVocabularyError } from "@/features/twitter-automation/social-studio-vocabulary";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

const IMAGE_MODES = [
  "ai-word-of-the-day",
  "ai-mini-quiz",
  "ai-false-friends",
  "ai-daily-challenge",
  "ai-vocabulary-progression",
  "ai-example-sentences",
] as const;

type ImageMode = (typeof IMAGE_MODES)[number];

interface AiImagePlan {
  artDirection: string;
  caption: string;
  falseFriend?: FalseFriendPair;
}

interface FalseFriendPair {
  firstTerm: string;
  secondTerm: string;
  firstMeaning: string;
  secondMeaning: string;
}

const falseFriendSchema = z.object({
  firstTerm: z.string().trim().min(1).max(120),
  secondTerm: z.string().trim().min(1).max(120),
  firstMeaning: z.string().trim().min(1).max(200),
  secondMeaning: z.string().trim().min(1).max(200),
}).strict();

const preparedPlanSchema = z.object({
  artDirection: z.string().trim().min(40).max(5_000),
  caption: z.string().trim().min(12).max(400),
  falseFriend: falseFriendSchema.optional(),
}).strict();

const requestSchema = z.object({
  mode: z.enum(IMAGE_MODES),
  language: z.string().refine(isLanguageCode),
  nativeLanguage: z.string().refine(isLanguageCode),
  tier: z.enum(["A1", "A2", "B1", "B2", "C1"]),
  preparedPlan: preparedPlanSchema.optional(),
}).superRefine((value, context) => {
  if (value.mode === "ai-false-friends" && value.preparedPlan && !value.preparedPlan.falseFriend) {
    context.addIssue({ code: "custom", path: ["preparedPlan", "falseFriend"], message: "False Friends plans require their selected pair." });
  }
});

const ENGLISH_LANGUAGE_NAMES: Record<LanguageCode, string> = {
  tr: "Turkish", en: "English", de: "German", ru: "Russian", fr: "French", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ar: "Arabic", ja: "Japanese", ko: "Korean", "zh-CN": "Chinese",
};

const MODE_BRIEFS: Record<ImageMode, string> = {
  "ai-word-of-the-day": "Create a premium Word of the Day campaign visual around one featured word. The word must be the hero, supported by a physical FoxiesDeck card, a compact meaning, and an approachable mascot moment. The choice must be completely random and must not repeat any word used in the previous few generations.",
  "ai-mini-quiz": "Create a playful mini vocabulary quiz visual. Show one clear question, three readable answer choices, and a compelling card-led composition that invites followers to answer in comments. Never reveal or hint at the correct answer. The word and choices must be completely random and must not repeat any word used in the previous few generations.",
  "ai-false-friends": "Create an editorial Easy to Confuse visual, never a single-word quiz. Independently choose two real, useful words from the selected learning language itself that share a meaning area but differ in nuance, intensity, register, scope, or typical situation. Ignore the supplied card terms for this mode. For example, English angry/furious works because both describe anger but furious is much stronger. Never choose cross-language false cognates, words that merely look or sound alike, direct translations, antonyms, or interchangeable synonyms. Show exactly two large, separate vocabulary cards or term panels side by side, with a clear compact contrast such as 'similar meaning' versus 'different nuance'. Do not ask 'What does ... mean?', do not use a single card, and do not hide the meanings as a quiz answer. The pair must be completely random and must not repeat any false-friend pair used in the previous few generations.",
  "ai-daily-challenge": "Create a Daily Challenge visual presenting three real words as a compact learning mission. It should feel rewarding, collectable, and suitable for a social post. The three words must be completely random and must not repeat any words used in the previous few generations.",
  "ai-vocabulary-progression": "Create a clean side-by-side vocabulary progression visual. The left column is clearly labelled Beginner and shows the supplied A1-A2 words with their real A1 or A2 tier badges. The right column is clearly labelled Advanced and shows a natural B2-C1 target-language alternative for each beginner word, aligned row-for-row. Every right-side term must be a genuine, more sophisticated alternative in the same meaning area, never the identical beginner word. Every Advanced card must visibly use a B2 or C1 tier badge and the matching B2/C1 tier colour treatment. Never show A1 or A2 on any Advanced card, even when its paired Beginner card is A1 or A2. The supplied A1-A2 cards are reference data for the left column only; do not copy their tier badges, colours, or difficulty to the Advanced column. Keep the two columns balanced, highly readable, and card-led. The beginner words and their advanced alternatives must be completely random and must not repeat any progression used in the previous few generations.",
  "ai-example-sentences": "Create an educational Example Sentences visual. The supplied cards each contain one real target-language example sentence and its native-language meaning; use those exact example sentences on the left side and their matching meanings on the right side, aligned sentence-for-sentence. The three cards are independent random tiers from A1 to C1; visibly show each card's real tier badge next to its sentence. Use a clean two-column layout, a small flag or language label above each column, the FoxiesDeck mascot at the bottom, and a polished card-like frame around each sentence pair. Keep the background light and neutral, use each row's own tier colour only as a subtle accent, and keep the text large and highly readable for social media. The three sentences and their meanings must be completely random and must not repeat any sentence used in the previous few generations.",
};

const CAPTION_BRIEFS: Record<ImageMode, string> = {
  "ai-word-of-the-day": "Start with a clear Word of the Day-style headline, then add one short sentence about the featured word.",
  "ai-mini-quiz": "Start with a playful quiz headline that invites followers to answer in comments. Do not reveal or hint at the answer.",
  "ai-false-friends": "Start with a clear Easy to Confuse-style headline, then explain the difference between the two learning-language words in one compact sentence.",
  "ai-daily-challenge": "Start with a motivating Daily Challenge-style headline, then invite followers to try the three words.",
  "ai-vocabulary-progression": "Start with a clear Beginner to Advanced-style headline, then frame the word pairs as a vocabulary upgrade.",
  "ai-example-sentences": "Start with a friendly '3 example sentences' headline, then invite followers to write their own sentence in the comments.",
};

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

async function getCardsForMode(mode: ImageMode, language: LanguageCode, nativeLanguage: LanguageCode, tier: Tier) {
  if (mode === "ai-false-friends") return [];
  if (mode === "ai-example-sentences") {
    const randomTiers = Array.from({ length: 3 }, () => pick<Tier>(TIERS));
    const termSets = await Promise.all(randomTiers.map((randomTier) => selectSocialStudioVocabularyTerms({ language, nativeLanguage, tier: randomTier, count: 1, generator: mode })));
    return await Promise.all(termSets.map(([term]) => resolveSocialStudioVocabularyCard(term!, language, nativeLanguage)));
  }
  if (mode === "ai-daily-challenge") {
    const randomTiers = Array.from({ length: 3 }, () => pick<Tier>(TIERS));
    const termSets = await Promise.all(randomTiers.map((randomTier) => selectSocialStudioVocabularyTerms({ language, nativeLanguage, tier: randomTier, count: 1, generator: mode })));
    return await Promise.all(termSets.map(([term]) => resolveSocialStudioVocabularyCard(term!, language, nativeLanguage)));
  }
  const count = mode === "ai-vocabulary-progression" ? 3 : 1;
  const selectionTier = mode === "ai-vocabulary-progression" ? "A1" : tier;
  const terms = await selectSocialStudioVocabularyTerms({ language, nativeLanguage, tier: selectionTier, count, generator: mode });
  return await Promise.all(terms.map((term) => resolveSocialStudioVocabularyCard(term, language, nativeLanguage)));
}

function serializeCards(cards: VocabularyCard[], nativeLanguage: LanguageCode) {
  return cards.map((card) => ({
    term: card.term,
    nativeMeaning: card.translations[nativeLanguage] || card.translation,
    englishMeaning: card.translations.en || card.translation,
    tier: card.tier,
    partOfSpeech: card.partOfSpeech,
    example: card.examples[0]?.sentence ?? card.example,
  }));
}

function parseAiImagePlan(rawPlan: string, mode: ImageMode): AiImagePlan | null {
  try {
    const parsed = JSON.parse(extractJsonObject(rawPlan)) as Partial<AiImagePlan>;
    const artDirection = typeof parsed.artDirection === "string" ? parsed.artDirection.trim() : "";
    const caption = typeof parsed.caption === "string" ? parsed.caption.trim() : "";
    const falseFriend = parseFalseFriendPair(parsed.falseFriend);
    if (artDirection.length < 40 || caption.length < 12 || (mode === "ai-false-friends" && !falseFriend)) return null;

    return {
      artDirection: artDirection.slice(0, 5000),
      caption: caption.slice(0, 400),
      ...(falseFriend ? { falseFriend } : {}),
    };
  } catch {
    return null;
  }
}

async function createArtDirection(mode: ImageMode, language: LanguageCode, nativeLanguage: LanguageCode, tier: Tier, cards: VocabularyCard[]) {
  if (!process.env.POYO_API_KEY?.trim()) return null;

  const instructions = [
      "You are the senior visual art director for FoxiesDeck, a playful multilingual vocabulary-card app.",
      mode === "ai-false-friends"
        ? "Return one JSON object with exactly three fields: artDirection, caption, and falseFriend. falseFriend is an object. Do not add markdown or any text outside the JSON object."
        : "Return one JSON object with exactly two string fields: artDirection and caption. Do not add markdown or any text outside the JSON object.",
      "artDirection must be a detailed, production-ready English image-generation prompt for a 1:1 social media visual.",
      `caption must be a ready-to-post social caption written in the selected native language. It needs a concise hook or title and natural emoji only when appropriate. End with exactly these native-language hashtags: ${getNativeCaptionHashtags(nativeLanguage).join(" ")}. Do not use English hashtags unless English is the selected native language. Keep it below 260 characters. If the visual asks a question, quiz, or challenge, never reveal or hint at its answer in the caption.`,
      "For False Friends mode only, also include a falseFriend object with exactly four string fields: firstTerm, secondTerm, firstMeaning, secondMeaning. Choose two real, related words from the selected learning language whose nuances differ clearly in intensity, register, scope, or typical situation. Do not choose cross-language false cognates, lookalikes, direct translations, antonyms, or interchangeable synonyms. The native language is only for writing the caption and explaining meanings, never for selecting the two terms. The pair must be completely random and must not repeat any false-friend pair used in the previous few generations.",
      `Caption format for this mode: ${CAPTION_BRIEFS[mode]}`,
      "Describe composition, camera angle, visual hierarchy, precise placement, lighting, material finish, typography treatment, and the relationship between the mascot and vocabulary cards.",
      "Use a polished minimalist 3D card-collecting aesthetic. Cards must look like real FoxiesDeck vocabulary cards, not generic flashcards.",
      "Use the selected card tier as the dominant colour family. Keep generous negative space and strong social-media readability.",
      "Three brand reference images are supplied in this exact order. Reference image 1 is FoxiesDeck's fox mascot. Use that exact mascot identity whenever a mascot appears. It is a 2D character by default; if the requested composition needs 3D, reinterpret the same face, ears, tail, palette, and expression as a faithful polished 3D figurine, never as a different fox or animal.",
      "Reference image 2 is the official FoxiesDeck splash wordmark. When the composition needs the FoxiesDeck name, reproduce only this wordmark, not a newly invented type treatment.",
      "Reference image 3 is the official FoxiesDeck logo. If a compact logo mark is useful, use this exact logo and do not substitute a generic symbol.",
      "Do not use sparkles, grid textures, fake interface chrome, watermarks, illegible filler text, or unrelated logos.",
      "If the composition includes text, use only a few large, exact strings from the supplied card data. Make every requested string clear and correctly spelled.",
      "When the visual asks followers a question, quiz, or challenge, never show, reveal, or hint at the answer. Keep the answer for comments and engagement.",
      "Use the native-language meanings supplied in the input for explanations and answer choices. Do not use English as a fallback unless English is the selected native language.",
      "Never invent vocabulary terms, translations, or example sentences beyond the supplied data unless the content brief explicitly asks for a false-friend comparison or a beginner-to-advanced progression pair.",
      "All vocabulary, examples, and comparisons must be completely random and must not repeat content from any previous generation.",
      MODE_BRIEFS[mode],
    ].join("\n");
  const input = {
      targetLanguage: ENGLISH_LANGUAGE_NAMES[language],
      nativeLanguage: ENGLISH_LANGUAGE_NAMES[nativeLanguage],
      selectedTier: tier,
      cards: serializeCards(cards, nativeLanguage),
    };
  const generatePlan = async (repair: boolean) => {
    const { output } = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_CREATIVE_MODEL,
      (client, model, signal) => client.responses.create({
      model,
      instructions: repair
        ? `${instructions}\nYour previous response was invalid. Return only valid JSON matching the required fields. For False Friends, include two related learning-language words with different nuance, not words that merely look alike or a cross-language translation pair.`
        : instructions,
      input: JSON.stringify(input),
      max_output_tokens: 700,
      reasoning: { effort: "none" },
      store: false,
      text: { format: { type: "text" }, verbosity: "medium" },
      }, { signal }),
      extractResponseOutputText,
    );
    return parseAiImagePlan(output.trim(), mode);
  };

  return await generatePlan(false) ?? await generatePlan(true);
}

function extractJsonObject(value: string) {
  const withoutFence = value
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace ? withoutFence.slice(firstBrace, lastBrace + 1) : withoutFence;
}

function parseFalseFriendPair(value: unknown): FalseFriendPair | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<FalseFriendPair>;
  const firstTerm = typeof candidate.firstTerm === "string" ? candidate.firstTerm.trim() : "";
  const secondTerm = typeof candidate.secondTerm === "string" ? candidate.secondTerm.trim() : "";
  const firstMeaning = typeof candidate.firstMeaning === "string" ? candidate.firstMeaning.trim() : "";
  const secondMeaning = typeof candidate.secondMeaning === "string" ? candidate.secondMeaning.trim() : "";
  const normalized = [firstTerm, secondTerm, firstMeaning, secondMeaning].map((item) => item.toLocaleLowerCase());

  if (normalized.some((item) => item.length < 2) || normalized[0] === normalized[1] || normalized[2] === normalized[3]) return null;
  return { firstTerm, secondTerm, firstMeaning, secondMeaning };
}

function createImagePrompt(mode: ImageMode, imagePlan: AiImagePlan) {
  if (mode !== "ai-false-friends" || !imagePlan.falseFriend) return imagePlan.artDirection;

  const pair = imagePlan.falseFriend;
  return [
    imagePlan.artDirection,
    "MANDATORY EASY-TO-CONFUSE FACTS. Render these exact facts and do not replace, translate, or invent terms:",
    `- First selected-learning-language term: \"${pair.firstTerm}\". It means: \"${pair.firstMeaning}\".`,
    `- Second selected-learning-language term: \"${pair.secondTerm}\". It means: \"${pair.secondMeaning}\".`,
    "Use the exact heading: EASY TO CONFUSE. Use the exact subheading: SIMILAR MEANING • DIFFERENT NUANCE.",
    "Show exactly two separate, equally prominent panels in the selected learning language, one per term, with its nuance visibly attached to the correct term. Do not show the native-language word as a second vocabulary term.",
    "Never render 'NOT a false friend', 'What does ... mean?', a cross-language translation pair, lookalike words, interchangeable synonyms, or a CEFR tier badge. These are comparison panels, not A1/A2/B1/B2 cards.",
  ].join("\n");
}

function createImageCaption(mode: ImageMode, language: LanguageCode, nativeLanguage: LanguageCode, fallbackCaption: string) {
  if (mode === "ai-word-of-the-day") return finalizeNativeCaption(fallbackCaption, nativeLanguage);

  const details = mode === "ai-mini-quiz"
    ? { kind: "miniQuiz" as const, itemCount: 1 }
    : mode === "ai-false-friends"
      ? { kind: "falseFriends" as const, itemCount: 2 }
      : mode === "ai-daily-challenge"
        ? { kind: "dailyChallenge" as const, itemCount: 3 }
        : mode === "ai-vocabulary-progression"
          ? { kind: "vocabularyProgression" as const, itemCount: 3 }
          : { kind: "exampleSentences" as const, itemCount: 3 };
  return createNativeVisualCaption({ kind: details.kind, learningLanguage: language, nativeLanguage, itemCount: details.itemCount });
}

export async function POST(request: Request) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) {
    return Response.json({ errorCode: "unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  if (!process.env.POYO_API_KEY?.trim()) {
    return Response.json({ errorCode: "poyo_not_configured" }, { status: 503 });
  }

  let imagePlan: AiImagePlan | null = parsed.data.preparedPlan ?? null;
  if (!imagePlan) {
    let cards: VocabularyCard[];
    try {
      cards = await getCardsForMode(parsed.data.mode, parsed.data.language, parsed.data.nativeLanguage, parsed.data.tier);
    } catch (error) {
      const errorCode = error instanceof SocialStudioVocabularyError ? error.code : getSocialStudioResponsesErrorCode(error) ?? "card_generation_failed";
      return Response.json({
        errorCode,
        diagnostic: createSocialStudioDiagnostic({ stage: "AI image vocabulary selection", provider: getSocialStudioResponsesProviderLabel(error, "PoYo Responses / Terra"), error, fallbackDetail: "The image could not select fresh vocabulary terms." }),
      }, { status: 502 });
    }

    try {
      imagePlan = await createArtDirection(parsed.data.mode, parsed.data.language, parsed.data.nativeLanguage, parsed.data.tier, cards);
    } catch (error) {
      return Response.json({
        errorCode: error instanceof SocialStudioVocabularyError ? error.code : getSocialStudioResponsesErrorCode(error) ?? "art_direction_failed",
        diagnostic: createSocialStudioDiagnostic({ stage: "AI image art-direction plan", provider: getSocialStudioResponsesProviderLabel(error, "PoYo Responses / Terra"), error, fallbackDetail: "The creative plan request failed." }),
      }, { status: 502 });
    }
  }

  if (!imagePlan) {
    return Response.json({
      errorCode: "invalid_ai_plan",
      diagnostic: createSocialStudioDiagnostic({ stage: "AI image plan validation", provider: "PoYo Responses / Terra", fallbackDetail: "The creative plan was missing required art direction or caption fields after repair." }),
    }, { status: 502 });
  }

  try {
    const image = await generatePoyoImageEdit({
      prompt: createImagePrompt(parsed.data.mode, imagePlan),
      size: "1:1",
    });

    return Response.json({
      imageUrl: image.dataUrl,
      artDirection: imagePlan.artDirection,
      caption: createImageCaption(parsed.data.mode, parsed.data.language, parsed.data.nativeLanguage, imagePlan.caption),
      plan: imagePlan,
    });
  } catch (error) {
    if (error instanceof PoyoImageError) {
      return Response.json({
        errorCode: error.code,
        diagnostic: createSocialStudioDiagnostic({ stage: "AI image render", provider: "PoYo Generate / GPT Image", error, fallbackDetail: "The image task could not be completed." }),
      }, { status: error.code === "poyo_not_configured" ? 503 : 502 });
    }
    return Response.json({
      errorCode: "image_generation_failed",
      diagnostic: createSocialStudioDiagnostic({ stage: "AI image render", provider: "PoYo Generate / GPT Image", error, fallbackDetail: "The image task failed unexpectedly." }),
    }, { status: 502 });
  }
}
