import { NextResponse } from "next/server";
import { isLanguageCode, isLocaleCode } from "@/data/languages";
import { VOCABULARY_CARDS } from "@/data/cards";
import { createRandomCardDesignTestSample } from "@/features/cards/card-design-test-sample";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get("excludeCardId") || undefined;
  const learningLanguage = searchParams.get("excludeLearningLanguage");
  const nativeLanguage = searchParams.get("excludeNativeLanguage");

  try {
    const sample = createRandomCardDesignTestSample(VOCABULARY_CARDS, {
      cardId,
      learningLanguage: learningLanguage && isLanguageCode(learningLanguage) ? learningLanguage : undefined,
      nativeLanguage: nativeLanguage && isLocaleCode(nativeLanguage) ? nativeLanguage : undefined,
    });

    return NextResponse.json(sample, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to choose a random vocabulary card.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
