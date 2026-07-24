import { NextResponse } from "next/server";
import { VOCABULARY_CARDS } from "@/data/cards";
import { isLanguageCode } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import type { Tier, VocabularyCard } from "@/types/domain";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";

type PostType = "word" | "phrase" | "random";

function isPhrase(card: VocabularyCard) {
  return card.termKind === "fixed_phrase" || /\s/u.test(card.term.trim());
}

export async function GET(request: Request) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) {
    return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language");
  const tier = searchParams.get("tier");
  const postType = searchParams.get("type") as PostType | null;

  if (!language || !isLanguageCode(language) || !TIERS.includes(tier as Tier) || !["word", "phrase", "random"].includes(postType ?? "")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const pool = VOCABULARY_CARDS.filter((card) => {
    if (card.language !== language || card.tier !== tier) return false;
    if (postType === "word") return !isPhrase(card);
    if (postType === "phrase") return isPhrase(card);
    return true;
  });

  const card = pool[Math.floor(Math.random() * pool.length)];

  if (!card) {
    return NextResponse.json({ error: "card_not_found" }, { status: 404 });
  }

  return NextResponse.json({ card });
}
