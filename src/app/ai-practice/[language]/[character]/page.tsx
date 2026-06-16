import { redirect } from "next/navigation";
import { isLanguageCode } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { getAiPracticeCharacter } from "@/features/ai-practice/ai-practice-data";
import { AiPracticeChatPanel } from "@/features/ai-practice/components/ai-practice-chat-panel";
import { requireAuthUser } from "@/features/auth/auth-session";
import type { Tier } from "@/types/domain";

type AiPracticeChatPageProps = {
  params: Promise<{ language: string; character: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AiPracticeChatPage({ params, searchParams }: AiPracticeChatPageProps) {
  const { language: rawLanguage, character: characterId } = await params;

  if (!isLanguageCode(rawLanguage)) {
    redirect("/ai-practice");
  }

  await requireAuthUser(`/ai-practice/${rawLanguage}/${characterId}`);

  const character = getAiPracticeCharacter(characterId);

  if (!character) {
    redirect(`/ai-practice/${rawLanguage}`);
  }

  const { tier: rawTier } = await searchParams;
  const tier: Tier =
    typeof rawTier === "string" && (TIERS as readonly string[]).includes(rawTier) ? (rawTier as Tier) : "A1";

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <AiPracticeChatPanel character={character} language={rawLanguage} tier={tier} />
    </section>
  );
}
