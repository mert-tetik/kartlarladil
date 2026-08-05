import { z } from "zod";
import { VOCABULARY_CARDS } from "@/data/cards";
import { isLanguageCode } from "@/data/languages";
import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { generatePoyoImageEdit, PoyoImageError } from "@/features/twitter-automation/poyo-image-generation";
import { createSocialStudioPoyoClient, generateSocialStudioTextWithFallback, PoyoResponsesProviderError, SOCIAL_CONTENT_CREATIVE_MODEL } from "@/features/twitter-automation/social-studio-poyo";
import { createSocialStudioDiagnostic } from "@/features/twitter-automation/social-studio-diagnostics";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const IMAGE_MODES = [
  "ai-word-of-the-day",
  "ai-mini-quiz",
  "ai-false-friends",
  "ai-daily-challenge",
  "ai-vocabulary-progression",
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

const requestSchema = z.object({
  mode: z.enum(IMAGE_MODES),
  language: z.string().refine(isLanguageCode),
  nativeLanguage: z.string().refine(isLanguageCode),
  tier: z.enum(["A1", "A2", "B1", "B2", "C1"]),
});

const ENGLISH_LANGUAGE_NAMES: Record<LanguageCode, string> = {
  tr: "Turkish", en: "English", de: "German", ru: "Russian", fr: "French", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ar: "Arabic", ja: "Japanese", ko: "Korean", "zh-CN": "Chinese",
};

const MODE_BRIEFS: Record<ImageMode, string> = {
  "ai-word-of-the-day": "Create a premium Word of the Day campaign visual around one featured word. The word must be the hero, supported by a physical FoxiesDeck card, a compact meaning, and an approachable mascot moment.",
  "ai-mini-quiz": "Create a playful mini vocabulary quiz visual. Show one clear question, three readable answer choices, and a compelling card-led composition that invites followers to answer in comments. Never reveal or hint at the correct answer.",
  "ai-false-friends": "Create an editorial Easy to Confuse visual, never a single-word quiz. Independently choose two real, well-established commonly confused words from the selected learning language itself. Ignore the supplied card terms for this mode. The two words must look or sound similar but have clearly different meanings, such as English affect/effect or German seit/seid. Never compare the learning language with the selected native language and never use a translation pair. Show exactly two large, separate vocabulary cards or term panels side by side, with a clear compact contrast such as 'looks similar' versus 'means different'. Do not ask 'What does ... mean?', do not use a single card, and do not hide the meanings as a quiz answer.",
  "ai-daily-challenge": "Create a Daily Challenge visual presenting three real words as a compact learning mission. It should feel rewarding, collectable, and suitable for a social post.",
  "ai-vocabulary-progression": "Create a clean side-by-side vocabulary progression visual. The left column is clearly labelled Beginner and shows the supplied A1-A2 words with their real A1 or A2 tier badges. The right column is clearly labelled Advanced and shows a natural B2-C1 target-language alternative for each beginner word, aligned row-for-row. Every right-side term must be a genuine, more sophisticated alternative in the same meaning area, never the identical beginner word. Every Advanced card must visibly use a B2 or C1 tier badge and the matching B2/C1 tier colour treatment. Never show A1 or A2 on any Advanced card, even when its paired Beginner card is A1 or A2. The supplied A1-A2 cards are reference data for the left column only; do not copy their tier badges, colours, or difficulty to the Advanced column. Keep the two columns balanced, highly readable, and card-led.",
};

const CAPTION_BRIEFS: Record<ImageMode, string> = {
  "ai-word-of-the-day": "Start with a clear Word of the Day-style headline, then add one short sentence about the featured word.",
  "ai-mini-quiz": "Start with a playful quiz headline that invites followers to answer in comments. Do not reveal or hint at the answer.",
  "ai-false-friends": "Start with a clear Easy to Confuse-style headline, then explain the difference between the two learning-language words in one compact sentence.",
  "ai-daily-challenge": "Start with a motivating Daily Challenge-style headline, then invite followers to try the three words.",
  "ai-vocabulary-progression": "Start with a clear Beginner to Advanced-style headline, then frame the word pairs as a vocabulary upgrade.",
};

function getCardsForMode(mode: ImageMode, language: LanguageCode, tier: Tier) {
  const tiers: Tier[] = mode === "ai-vocabulary-progression"
    ? ["A1", "A2"]
      : mode === "ai-false-friends"
        ? ["A1", "A2", "B1", "B2", "C1"]
        : [tier];
  const count = mode === "ai-daily-challenge" || mode === "ai-vocabulary-progression" ? 3 : 1;
  const pool = VOCABULARY_CARDS.filter((card) => card.language === language && tiers.includes(card.tier) && card.termKind === "word");
  return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
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
      "caption must be a ready-to-post social caption written in the selected native language. It needs a concise hook or title, natural emoji only when appropriate, and two or three relevant hashtags including #languagelearning. Keep it below 260 characters. If the visual asks a question, quiz, or challenge, never reveal or hint at its answer in the caption.",
      "For False Friends mode only, also include a falseFriend object with exactly four string fields: firstTerm, secondTerm, firstMeaning, secondMeaning. Choose two real, commonly confused words from the selected learning language itself. The two terms must look or sound similar but have clearly different meanings. Never choose a word from the native language, direct translations, or a pair whose meanings are identical. The native language is only for writing the caption and explaining meanings, never for selecting the two terms.",
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
      MODE_BRIEFS[mode],
    ].join("\n");
  const input = {
      targetLanguage: ENGLISH_LANGUAGE_NAMES[language],
      nativeLanguage: ENGLISH_LANGUAGE_NAMES[nativeLanguage],
      selectedTier: tier,
      cards: serializeCards(cards, nativeLanguage),
    };
  const poyo = createSocialStudioPoyoClient();
  const generatePlan = async (repair: boolean) => {
    const { output } = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_CREATIVE_MODEL,
      (model) => poyo.responses.create({
      model,
      instructions: repair
        ? `${instructions}\nYour previous response was invalid. Return only valid JSON matching the required fields. For False Friends, include two commonly confused words from the selected learning language with different meanings. Never use a cross-language translation pair.`
        : instructions,
      input: JSON.stringify(input),
      max_output_tokens: 700,
      reasoning: { effort: "none" },
      store: false,
      text: { format: { type: "text" }, verbosity: "medium" },
      }),
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
    "Use the exact heading: EASY TO CONFUSE. Use the exact subheading: LOOKS SIMILAR • MEANS DIFFERENT.",
    "Show exactly two separate, equally prominent panels in the selected learning language, one per term, with their different meanings visibly attached to the correct term. Do not show the native-language word as a second vocabulary term.",
    "Never render 'NOT a false friend', 'What does ... mean?', a cross-language translation pair, identical meanings, or a CEFR tier badge. These are comparison panels, not A1/A2/B1/B2 cards.",
  ].join("\n");
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

  const cards = getCardsForMode(parsed.data.mode, parsed.data.language, parsed.data.tier);
  if (!cards.length) {
    return Response.json({ errorCode: "card_not_found" }, { status: 404 });
  }

  let imagePlan: AiImagePlan | null;
  try {
    imagePlan = await createArtDirection(parsed.data.mode, parsed.data.language, parsed.data.nativeLanguage, parsed.data.tier, cards);
  } catch (error) {
    return Response.json({
      errorCode: error instanceof PoyoResponsesProviderError ? "poyo_responses_provider_error" : "art_direction_failed",
      diagnostic: createSocialStudioDiagnostic({ stage: "AI image art-direction plan", provider: "PoYo Responses / Terra", error, fallbackDetail: "The creative plan request failed." }),
    }, { status: 502 });
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
      caption: imagePlan.caption,
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
