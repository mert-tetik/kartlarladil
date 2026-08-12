import { NextResponse } from "next/server";
import { z } from "zod";
import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import {
  createRandomSocialStudioWordOfTheDayPosterCard,
  resolveSocialStudioVocabularyCard,
  selectSocialStudioVocabularyTerms,
  SocialStudioVocabularyError,
} from "@/features/twitter-automation/social-studio-vocabulary";

const requestSchema = z.object({
  language: z.enum(LANGUAGE_CODES),
  nativeLanguage: z.enum(LOCALE_CODES),
  tier: z.enum(TIERS),
  generator: z.string().trim().min(1).max(80).default("self-vocabulary-card"),
});

export async function POST(request: Request) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) {
    return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    if (parsed.data.generator === "word-of-the-day-poster") {
      const card = await createRandomSocialStudioWordOfTheDayPosterCard(parsed.data.language, parsed.data.nativeLanguage);
      return NextResponse.json({ card }, { headers: { "Cache-Control": "no-store" } });
    }

    const [term] = await selectSocialStudioVocabularyTerms({ ...parsed.data, count: 1 });
    const card = await resolveSocialStudioVocabularyCard(term!, parsed.data.language, parsed.data.nativeLanguage);
    return NextResponse.json({ card }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const errorCode = error instanceof SocialStudioVocabularyError ? error.code : "card_generation_failed";
    return NextResponse.json({ errorCode }, { status: 502 });
  }
}
